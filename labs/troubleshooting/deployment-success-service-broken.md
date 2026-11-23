# Deployment успешен, но сервис сломан

## Сценарий

Deployment завершился успешно: rollout сообщает об успехе, новые Pod запущены, они Ready, Service имеет endpoints. Однако пользователи получают HTTP 500, некорректные ответы или бизнес-функция не работает.

**Ключевой принцип:** успешный Deployment/rollout подтверждает, что Kubernetes выполнил обновление согласно своим критериям, но не доказывает работоспособность бизнес-функциональности приложения.

## Симптомы

- CI/CD pipeline зелёный, deployment step завершён.
- `kubectl rollout status deployment/<name>` сообщает об успешном rollout.
- Pod находятся в Running, Ready; рестартов может не быть.
- Service имеет endpoints и TCP/HTTP соединение устанавливается.
- Пользовательский запрос возвращает 500/502, некорректные данные, пустой результат или timeout.
- Ошибка появилась после релиза, но связь с релизом пока только временная.

## Impact

Определи scope прежде чем менять что-либо:

- Все пользователи или отдельные запросы/функции?
- Один endpoint или весь сервис?
- Все replicas или только часть?
- Сразу после deploy или постепенно?
- Есть ли затронутые downstream-зависимости?

Зафиксируй начало инцидента, примеры запросов, error rate и latency.

## 1. Проверить контекст и rollout

Начинай с read-only команд.

```bash
kubectl config current-context
kubectl get deploy,pods,svc -n <namespace>
kubectl rollout status deployment/<deployment> -n <namespace>
kubectl rollout history deployment/<deployment> -n <namespace>
kubectl describe deployment/<deployment> -n <namespace>
```

Проверь:

- ожидаемый ли context и namespace;
- какой ReplicaSet создан новым rollout;
- image tag/digest и время изменения;
- replicas, updated, available;
- rollout действительно завершился, а не просто начался;
- какие изменения внесены в template: image, env, ConfigMap/Secret references, probes, resources.

Не публикуй значения Secret или credentials. Сравнивай ссылки/имена и безопасно проверяй конфигурацию, не выводя секреты.

## 2. Убедиться, что Pod готовы, но не делать из этого вывод о здоровье приложения

```bash
kubectl get pods -n <namespace> -o wide
kubectl describe pod/<pod> -n <namespace>
kubectl get events -n <namespace> --sort-by=.lastTimestamp
```

Ready означает, что readiness criteria прошли. Если readiness probe проверяет только доступность порта или простой health endpoint, она может не обнаружить сбой бизнес-логики, базы данных, внешнего API или конкретного маршрута.

Проверь, что probe действительно проверяет, и сопоставь её с наблюдаемым пользовательским симптомом.

## 3. Проверить Service и endpoints

```bash
kubectl get svc <service> -n <namespace> -o yaml
kubectl get endpoints <service> -n <namespace>
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service>
```

Если endpoints присутствуют, это снижает вероятность проблемы с selector/readiness на уровне Service, но не подтверждает корректность ответов приложения.

Проверь selector, port/targetPort и список адресов. Сопоставь endpoints с новыми Pod и убедись, что не направляешь трафик на неожиданные replicas.

## 4. Воспроизвести симптом и локализовать уровень отказа

Используй разрешённый источник запроса: клиент, test environment, curl из диагностического Pod или port-forward (если это разрешено и не изменяет состояние приложения).

Пример HTTP-проверки:

```bash
curl -i --max-time 10 http://<host>/<path>
```

Для API проверь конкретный endpoint, метод, headers и безопасный test payload. Не повторяй POST/PUT/DELETE к production без подтверждения их безопасного характера.

Различай:

- DNS failure — имя не разрешается;
- connection refused — соединение отвергается;
- timeout — соединение/ответ не завершился вовремя;
- HTTP 4xx — запрос, auth, routing или бизнес-условия;
- HTTP 5xx — ошибка приложения или зависимости, но статус сам по себе не указывает root cause;
- корректный HTTP 200 с неверными данными — возможная бизнес-логическая или data issue.

## 5. Изучить логи новой версии

```bash
kubectl logs deployment/<deployment> -n <namespace> --since=15m --all-pods=true
kubectl logs pod/<pod> -n <namespace> --since=15m
```

Если контейнеров несколько, уточни container name через `kubectl get pod/<pod> -n <namespace> -o jsonpath='{.spec.containers[*].name}'` и используй `-c <container>`.

Ищи:

- exception / stack trace;
- ошибки конфигурации или отсутствующие env;
- connection refused / timeout к БД или API;
- authentication/authorization failures;
- schema mismatch;
- ошибки сериализации/валидации;
- ошибки, появившиеся после времени deployment.

Не ограничиваивайся grep по ERROR: warning, retry, timeout и application-specific error code могут быть важнее.

## 6. Сопоставить с релизом

```bash
kubectl rollout history deployment/<deployment> -n <namespace>
kubectl get deployment/<deployment> -n <namespace> -o yaml
kubectl get rs -n <namespace> -o wide
```

Собери факты о:

- предыдущем и текущем image (используй tag и по возможности digest);
- изменениях ConfigMap/Secret references;
- изменениях аргументов, переменных окружения, портов и probes;
- миграциях БД и совместимости schema;
- внешних зависимостях и feature flags;
- изменениях трафика, если используется canary/blue-green.

Не предполагай, что «последний релиз виноват», пока не сопоставишь время, evidence и affected functionality.

## 7. Проверить dependencies

Приложение может быть Running и Ready, но зависимость недоступна или несовместима.

Проверь по конкретному evidence:

- DB connectivity, ошибки SQL, schema migration, connection pool;
- Redis/cache connectivity, TTL, stale/missing cache;
- Kafka/RabbitMQ connectivity, consumer lag, processing errors;
- внешний API: DNS, TCP/TLS, status codes, timeout, auth;
- конфигурация endpoint, credentials reference, certificates и feature flags.

Используй специализированные labs по PostgreSQL connection exhaustion, Redis cache miss storm и Kafka consumer lag, если симптомы указывают на эти компоненты.

## 8. Сопоставить Metrics, Logs и Events

В Grafana сравни период до и после deploy:

- request rate;
- error rate (5xx и application errors);
- p50/p95/p99 latency;
- saturation: CPU throttling, memory, thread/connection pools;
- dependency metrics;
- количество replicas и restart rate.

В логах ищи correlation/request ID и временные метки. Kubernetes Events — вспомогательный источник; бизнес-ошибки часто не отражаются в Events.

Сформулируй проверяемую гипотезу, например: «новая версия обращается к изменившемуся endpoint БД, поэтому бизнес-запрос падает; Pod Ready, поскольку readiness probe не проверяет этот запрос».

## 9. Root cause — только после подтверждения

Возможные причины (это гипотезы, не готовый диагноз):

| Возможная причина | Что подтвердит |
|---|---|
| Ошибка приложения в новом build | Stack trace, воспроизводимый запрос, сравнение версий |
| Некорректная ConfigMap/env | Diff безопасной конфигурации и application error |
| Несовместимая DB schema / миграция | SQL error, migration history, подтверждение версии schema |
| Внешняя зависимость недоступна | Timeout/connectivity/status evidence |
| Feature flag включил проблемный путь | Flag state, correlation с запросом |
| Readiness слишком поверхностная | Probe проходит, а критический workflow падает |
| Частичный rollout / разные версии replicas | Image digest по Pod, ReplicaSet и запросы к разным replicas |

## 10. Mitigation и rollback plan

Не выполняй изменения автоматически. Сначала согласуй mitigation, оцени риск и подготовь план возврата.

Возможные действия после подтверждения root cause:

- rollback Deployment к предыдущей revision, если это совместимо с миграциями и изменениями данных;
- исправить конфигурацию через утверждённый change process;
- отключить проблемный feature flag, если есть безопасная процедура;
- переключить/ограничить трафик по согласованному плану;
- исправить зависимость отдельно, если rollback приложения не решит проблему.

Rollback не всегда безопасен: после database migration или изменения формата данных предыдущая версия может быть несовместима.

Команды ниже — только план, **не запускай без разрешения и проверки последствий**:

```bash
# PLAN ONLY — mutating action; requires approval
kubectl rollout undo deployment/<deployment> -n <namespace>
```

## 11. Verification после исправления

- Повторить исходный запрос или workflow.
- Убедиться, что status code и payload ожидаемые.
- Сравнить error rate и latency с baseline.
- Проверить logs на исчезновение исходной ошибки.
- Проверить affected dependencies.
- Убедиться, что replicas стабильно Ready и не происходит повторных рестартов.
- Наблюдать за системой достаточное время, чтобы проверить отсутствие recurrence.
- Зафиксировать версию, mitigation и результаты.

## 12. Incident report

Заполни краткий отчёт:

- **Symptoms:** что увидели пользователи?
- **Impact:** кого/что затронуло?
- **Timeline:** deploy, первые симптомы, detection, mitigation.
- **Evidence:** rollout, Pod, Service, logs, metrics, dependency checks.
- **Root cause:** что доказано и каким evidence?
- **Resolution:** что изменили и кто согласовал?
- **Verification:** какие проверки подтвердили восстановление?
- **Prevention:** тесты, улучшение probes, alerting, release gates, dashboard или runbook.

## Критерии прохождения

- [ ] Объясняю, что успешный rollout не равен успешному сервису.
- [ ] Проверяю context, namespace, rollout, ReplicaSet и image.
- [ ] Отличаю Pod Ready от корректности бизнес-функции.
- [ ] Проверяю Service/endpoints и воспроизводю симптом.
- [ ] Анализирую logs и сопоставляю время с релизом.
- [ ] Проверяю зависимости по evidence, а не перебираю их наугад.
- [ ] Использую Metrics + Logs + Events для подтверждения гипотезы.
- [ ] Могу подготовить rollback/mitigation plan и verification без самовольного применения изменений.
