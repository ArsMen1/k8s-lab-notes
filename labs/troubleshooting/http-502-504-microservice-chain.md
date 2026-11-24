# Lab: HTTP 502/504 — диагностика цепочки микросервисов

## Сценарий

Пользователи жалуются на ошибки при оформлении заказа. API Gateway начал отдавать 502 и 504, но Kubernetes показывает все Pod как `Running`, большинство — `Ready`. DNS и Service discovery работают. Тебе нужно найти, **на каком звене цепочки запрос замедляется или ломается**, и отделить первопричину от последствий.

Это учебный incident. Метрики, логи и trace ниже синтетические. Начинай с read-only диагностики. Не перезапускай сервисы и не меняй timeout/retry/replicas, пока не соберёшь evidence и не согласуешь mitigation.

## Impact

- У части клиентов оформление заказа не завершается.
- Gateway 5xx вырос, но не все запросы затронуты.
- Затронутый workflow: `POST /api/orders`.
- Остальные API endpoints частично работают.

## Timeline

| Время | Событие |
|---|---|
| 14:00 | Базовые показатели нормальные |
| 14:07 | В downstream inventory-service начался рост latency |
| 14:10 | У orders-service выросло время ожидания downstream |
| 14:12 | Gateway error rate начал расти |
| 14:15 | Alert: gateway 5xx > 5% |
| 14:18 | Incident объявлен, investigation начинается |

## Симптомы и метрики

### Gateway (5-minute window)

| Metric | Baseline | During incident |
|---|---:|---:|
| Request rate | 420 req/s | 410 req/s |
| 5xx rate | 0.3% | 8.6% |
| p50 latency | 90 ms | 130 ms |
| p95 latency | 240 ms | 3.8 s |
| p99 latency | 410 ms | 5.0 s |
| 502 | 0.1% | 1.2% |
| 504 | 0.1% | 7.4% |

### Kubernetes overview

```text
$ kubectl get pods -n commerce
NAME                                  READY   STATUS    RESTARTS
api-gateway-7c8b9d-4f2q              2/2     Running   0
orders-service-6f9b7d-9x2m            2/2     Running   0
orders-service-6f9b7d-p5kd            2/2     Running   0
inventory-service-5d7c8f-k4j8           2/2     Running   0
inventory-service-5d7c8f-q7w2           2/2     Running   0
payment-service-6c4f7b-a1p9             2/2     Running   0
```

Pod состояние само по себе не доказывает, что request path здоров. Readiness probe может проверять лишь локальный процесс или health endpoint и не проверять реальную downstream-операцию.

## Схема request path

```text
Client
  |
  v
API Gateway (timeout 5s)
  |
  v
orders-service (inventory client timeout/retry settings to inspect)
  |
  +----> inventory-service
  |         |
  |         +----> inventory DB
  |
  +----> payment-service
```

Для этой лаборатории не предполагай, что все ошибки возникают в Gateway. Gateway может только возвращать статус, вызванный нижним звеном.

## Задание

1. Уточни scope и timeline инцидента.
2. Проверь Kubernetes context и namespace; собери состояние Deployments, Pods, Services и EndpointSlices.
3. Подтверди, что gateway получает HTTP 5xx и отличи 502 от 504 по logs/metrics.
4. Сопоставь request/correlation ID на нескольких звеньях.
5. Найди медленный span и выясни, какой downstream call занимает большую часть времени.
6. Проверь, как retries влияют на количество запросов и latency.
7. Сформулируй root cause только на основании evidence.
8. Предложи безопасную mitigation, оцени её риск и критерии rollback.
9. Определи verification и prevention.

## 1. Read-only: проверить контекст и Kubernetes

```bash
kubectl config current-context
kubectl get deploy,pods,svc -n commerce -o wide
kubectl get endpointslices -n commerce -o wide
kubectl get events -n commerce --sort-by=.metadata.creationTimestamp
```

Уточни:

- context действительно тот, где расследуешь инцидент;
- все replicas и версии;
- Pod Ready/restarts;
- Services, ports, selectors, targetPorts;
- EndpointSlice addresses и conditions;
- rollout/change timeline.

Не делай вывод «Kubernetes исправен — проблема не в Kubernetes». Эти команды лишь проверяют состояние объектов control plane; они не подтверждают успешное выполнение application request.

## 2. Уточни Gateway error details

Пример агрегированного access log:

```text
14:18:03.412 request_id=ord-7f31 method=POST path=/api/orders status=504
 upstream=orders-service:8080 upstream_status=504
 upstream_connect_time=0.004 upstream_header_time=- upstream_response_time=5.001

14:18:04.106 request_id=ord-7f32 method=POST path=/api/orders status=502
 upstream=orders-service:8080 upstream_status=502
 upstream_connect_time=0.003 upstream_header_time=0.012 upstream_response_time=0.018

14:18:04.921 request_id=ord-7f33 method=POST path=/api/orders status=504
 upstream=orders-service:8080 upstream_status=504
 upstream_connect_time=0.005 upstream_header_time=- upstream_response_time=5.002
```

В реальной системе формат зависит от ingress/proxy. Уточняй доступные поля: status, upstream status, connect/header/response time, upstream address, request ID, retries, route.

**Важно:** статус 502/504 не универсально означает одну причину. Смотри конкретный proxy и его log fields:
- 502 может возникать из-за connection reset, premature close, некорректного upstream response, protocol/TLS mismatch или других gateway-level ошибок.
- 504 часто означает, что proxy не получил ответ вовремя, но timeout может происходить при connect, read или ожидании заголовков — это зависит от реализации и конфигурации.
- Иногда upstream самостоятельно возвращает 502/504; различай gateway-generated и upstream-returned статус.

## 3. Сопоставь request ID в application logs

Пример логов:

```text
orders-service:
14:18:03.413 INFO request_id=ord-7f31 request started POST /api/orders
14:18:03.416 INFO request_id=ord-7f31 calling inventory-service

inventory-service:
14:18:03.419 INFO request_id=ord-7f31 GET /stock/sku-42 started
14:18:08.420 WARN request_id=ord-7f31 dependency timeout inventory-db query

orders-service:
14:18:08.422 ERROR request_id=ord-7f31 inventory call timed out
14:18:08.423 ERROR request_id=ord-7f31 order request failed

gateway:
14:18:08.424 WARN request_id=ord-7f31 upstream timeout; client response 504
```

Сопоставляй записи по request/correlation ID и timestamps. Если сервисы используют distributed tracing, учитывай trace ID/span ID и parent-child relationships. Не предполагается, что один ID автоматически проброшен во все приложения: проверь, используется ли единый формат и propagation headers.

## 4. Metrics: найди звено с latency

Synthetic service metrics:

| Service | p50 | p95 | p99 | Error rate |
|---|---:|---:|---:|---:|
| Gateway | 130 ms | 3.8 s | 5.0 s | 8.6% |
| orders-service | 110 ms | 3.5 s | 4.9 s | 8.1% |
| inventory-service | 2.1 s | 4.6 s | 4.9 s | 12.4% |
| payment-service | 95 ms | 180 ms | 260 ms | 0.2% |

CPU и memory:

| Service | CPU usage | Memory usage |
|---|---:|---:|
| Gateway | 34% | 51% |
| Orders | 42% | 63% |
| Inventory | 39% | 58% |
| Payment | 27% | 46% |

Нормальные CPU/memory не исключают latency bottleneck. Приложение может ждать DB, lock, connection pool, external API или network I/O.

Вопросы:
- Какой service имеет резко выросшие p95/p99?
- Какой service может быть лишь жертвой downstream задержки?
- Почему averages/p50 недостаточно?
- Какие pool/queue/wait metrics следует проверить дальше?

## 5. Distributed tracing (если доступен)

Ожидаемый trace для проблемного запроса:

```text
POST /api/orders                         5.01s
├── validate request                     12ms
├── load customer                        34ms
├── inventory-service GET /stock          4.91s
│   ├── HTTP client wait                 4.90s
│   └── inventory DB query               4.72s
└── payment-service authorize              [not reached]
```

В trace UI проверь:

- trace ID и выборку именно failed/slow requests;
- самый длинный span и его parent;
- service name, operation, status/error;
- client span и соответствующий server span;
- retries — отдельные попытки могут увеличивать суммарную задержку;
- пропущенные spans, sampling и clock synchronization, которые могут искажать картину.

Не считай самый длинный span автоматическим root cause: он показывает место задержки, но причину ожидания выясняй по logs, DB, pool, downstream metrics.

## 6. Проверки Service/Endpoint и connectivity

Если evidence указывает на сеть или service discovery, используй существующую лабораторию [Service connectivity](service-connectivity.md).

Read-only checks:

```bash
kubectl get svc -n commerce
kubectl get endpointslices -n commerce -l kubernetes.io/service-name=inventory-service -o yaml
kubectl get pods -n commerce --show-labels -o wide
```

Connectivity test из approved diagnostic source, если инструменты доступны:

```bash
curl -sS -o /dev/null -w 'code=%{http_code} connect=%{time_connect} ttfb=%{time_starttransfer} total=%{time_total}\n' --max-time 6 http://inventory-service.commerce.svc.cluster.local:8080/health
```

Health endpoint не заменяет test конкретного workflow. Не отправляй повторные mutating requests вроде создания заказов без разрешённого тестового payload и понимания их side effects.

## 7. Проверить timeout и retry behavior

Собери конфигурацию, не выводя secrets:

- Gateway upstream connect/read/response timeout;
- orders-service timeout на inventory call;
- retry count, retryable status codes и backoff;
- deadline/request timeout на всём workflow;
- connection pool limits и pending queue;
- concurrency limits / bulkhead;
- circuit breaker state;
- DB pool и query latency.

Сравни timeout values по цепочке. Вложенные timeout и retries могут привести к тому, что одна клиентская операция запускает несколько downstream попыток, перегружая уже медленную зависимость. В синтетическом trace этого сценария показана одна попытка вызова inventory; конкретные timeout/retry values для orders-service намеренно не заданы. Не предполагай наличие retry только по общей конфигурации — подтверди число попыток по logs/spans.

Не увеличивай timeout как универсальное исправление: это может увеличить количество одновременно ожидающих запросов, занять threads/connections и ухудшить cascading failure. Не отключай retries без анализа — retries могут быть важны для кратковременных transient failures, но усиливать устойчивую деградацию.

## 8. Root cause (открой после расследования)

<details>
<summary>Скрытый spoiler: предполагаемая первопричина</summary>

В inventory-service изменилась нагрузка на inventory DB после релиза: запрос проверки наличия стал выполнять медленный запрос из-за регрессии/неэффективного плана. DB query p95 вырос до ~4.7s. Inventory HTTP handler ждает DB, orders-service ждёт inventory, Gateway достигает своего 5-second deadline и отдаёт 504.

Часть 502 возникает при закрытии/сбросе upstream соединения в момент истечения deadline/прерывания обработчика. Подтверждай такие статусы по конкретным gateway logs; не выводи это из таблицы метрик в одиночку.

Evidence:
- Gateway upstream response time около 5 секунд у 504.
- Orders span почти целиком ждёт inventory.
- Inventory span показывает DB query как доминирующую длительность.
- Payment span не достигается в failed workflow.
- CPU/memory не показывают saturation.
- Kubernetes Pod, Service и EndpointSlice выглядят нормально.

Root cause — регрессия latency запроса к inventory DB после изменения, а 502/504 — downstream effects в цепочке.

</details>

## 9. Mitigation plan

Порядок действий зависит от подтверждения и change approval:

1. Оценить scope: процент ошибок, affected route, customer impact.
2. Проверить, есть ли безопасный rollback inventory-service или DB query change.
3. Если подтверждён query regression, согласовать rollback или targeted query fix.
4. При необходимости согласовать ограничение трафика, concurrency или feature flag, чтобы защитить DB.
5. Не масштабировать orders-service автоматически: это может увеличить нагрузку на inventory DB.
6. Не повышать timeout/retries как первое действие.
7. Не перезапускать все Pods — рестарт не исправляет медленный query plan.

В рамках этой лаборатории не применяй изменения. Подготовь mitigation proposal, риск, owner, verification criteria и rollback plan.

## 10. Verification

После согласованной mitigation сравни с baseline:

- Gateway 5xx rate и отдельно 502/504;
- p50/p95/p99 gateway и inventory-service latency;
- DB query latency и нагрузку;
- число retries, pending requests и pool wait;
- успешность workflow `POST /api/orders` в approved test environment;
- trace проблемного и успешного запроса;
- отсутствие роста error rate на других endpoints.

Успех — это не только снижение 504. Проверь, что запрос завершается с корректным бизнес-результатом, DB не перегружена, retries не создают новую волну и улучшение стабильно.

## 11. Incident report

- **Symptoms:** что увидели клиенты, какие HTTP status codes?
- **Impact:** какой route, процент запросов, пользователи, длительность?
- **Timeline:** deploy/change, первые метрики, alert, investigation, mitigation.
- **Evidence:** gateway logs, correlation IDs, metrics, traces, DB evidence.
- **Root cause:** какая зависимость/операция замедлилась и чем подтверждено?
- **Mitigation:** что согласовано и применено?
- **Verification:** какие metrics и workflow подтвердили восстановление?
- **Prevention:** query review, performance tests, alert on dependency latency, tracing, timeout/retry policy, dashboard.

## 12. Шпаргалка: статус не равен диагнозу

| Симптом | Что проверять |
|---|---|
| 502 | Gateway logs; upstream reset/invalid response; protocol/TLS; gateway vs upstream status |
| 504 | Где именно истёк timeout: connect, response/read, application deadline |
| Gateway 5xx, Pod Ready | Application logs, request IDs, dependencies, readiness depth |
| Один service p95 вырос | Downstream spans, DB/pool, external API, queue/wait |
| CPU низкий, latency высокая | I/O wait, DB locks, connection/thread pools, network |
| Retry rate растёт | Retry policy, amplification, idempotency, backoff |
| Ошибки после release | Compare versions/config/schema, correlate timeline, prove causality |

## Критерии прохождения

- [ ] Проверяю context/namespace и состояние Kubernetes read-only.
- [ ] Отличаю gateway-generated status от upstream status, если logs это позволяют.
- [ ] Понимаю разницу между 502 и 504, но не трактую code как root cause.
- [ ] Сопоставляю request ID / trace ID между сервисами.
- [ ] Использую p95/p99 и dependency metrics, а не только CPU/memory или averages.
- [ ] Нахожу bottleneck в trace и подтверждаю его дополнительным evidence.
- [ ] Учитываю retries, deadlines, timeout nesting и cascading failure.
- [ ] Предлагаю mitigation с рисками, approval и rollback plan.
- [ ] Проверяю результат по business workflow, error rate, latency и downstream health.
