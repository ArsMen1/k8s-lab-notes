# Scaling incident: replicas выросли, а сервис стал хуже

## Сценарий

После увеличения replicas или срабатывания HPA latency/error rate ухудшились. CPU/RAM каждого Pod могут быть умеренными, но downstream dependency перегружена, connection pool исчерпан или retries создают дополнительную нагрузку.

## 1. Определи impact и временную связь

- Когда ухудшение началось относительно scale-up?
- p95/p99, throughput, error rate и backlog.
- Сколько replicas было до/после? Все ли Pod Ready?
- Какие общие зависимости используют replicas?

## 2. Сними read-only состояние Kubernetes

```bash
kubectl get deploy,rs,pods,hpa -n <namespace>
kubectl describe hpa <hpa> -n <namespace>
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl top pods -n <namespace> --containers
kubectl top node
```

Сверь HPA current/desired replicas, conditions, metrics, resource requests, rollout и распределение по Node. `kubectl top` — текущий снимок, не исторический peak.

## 3. Проверь приложение и зависимости

Запроси/посмотри dashboard, logs и traces:
- latency/error rate у DB и downstream API;
- connection pool: active, idle, waiting, timeouts;
- очередь, backlog, consumer lag и processing rate;
- retries, retry storm, rate limits;
- threads/workers, rejection, locks;
- concurrency и лимиты dependency.

Scaling может увеличить число одновременных запросов и соединений к shared dependency. Если проблема именно там, дополнительная replicas не обязательно повышает throughput и может усилить перегрузку.

## 4. Сформулируй причинную гипотезу

Пример: HPA увеличил replicas → каждая replica создала pool до 40 соединений → DB допустила 200 → 8 replicas потенциально создают 320 соединений → растут DB wait и timeouts → retries добавляют нагрузку → latency растёт.

Это пример механизма, не готовый root cause. Подтверди числа и связь по evidence.

## 5. Safe response (план, не исполнять)

- Не масштабируй дальше вслепую.
- Оцени лимиты dependency и суммарную concurrency/pool при текущем числе replicas.
- Обсуди с владельцами сервиса временное ограничение concurrency, rate limiting, retries/backoff, стабилизацию HPA или откат изменения.
- Любое изменение replicas/HPA/deployment — только по согласованной процедуре.

## 6. Verification

После разрешённой mitigation сравни:
- p95/p99, error rate, throughput;
- dependency latency/connection saturation;
- queue backlog/age;
- retries;
- число Ready replicas и HPA behavior.

Убедись, что улучшение не маскирует проблему и не создаёт повторного инцидента при возврате нагрузки.

## Итог

Incident report: impact, timeline, change correlation, evidence, root cause, safe mitigation, verification, prevention.

Команды в этом lab read-only. Не применяй изменения без разрешения.
