# Lab: PostgreSQL locks & deadlocks — запросы ждут, CPU низкий

## Сценарий

После релиза пользователи жалуются, что обновление заказов иногда зависает на несколько секунд, а затем завершается timeout. PostgreSQL доступен, CPU не высокий, количество connections не исчерпано. В Grafana растёт время ожидания запросов, а в application logs появляются сообщения о lock timeout и transaction rollback.

Твоя задача — различить **lock contention, deadlock, slow query и connection pool saturation**, найти блокирующую сессию, собрать evidence и подготовить безопасный mitigation plan.

Все данные и логи в этой лаборатории synthetic. Начинай с read-only. Не запускай UPDATE/DELETE, не создавай locks намеренно и не завершай PostgreSQL sessions без approval.

## Impact

- Endpoint PATCH /orders/{id} периодически отвечает медленно.
- p95 вырос с 220 ms до 4.1 s.
- Ошибки timeout/5xx: 4.7%.
- Затронуты не все заказные операции.
- CPU PostgreSQL около 31%; memory 59%.
- Connection count: 58/100 — slots не исчерпаны.

## Timeline

| Время | Событие |
|---|---|
| 10:00 | Baseline нормальный |
| 10:06 | Релиз orders-service |
| 10:12 | Начинается рост latency update order |
| 10:15 | Lock wait metrics растут |
| 10:18 | Появляются первые lock timeout |
| 10:22 | Alert по p95 и 5xx |
| 10:25 | Начало расследования |

## Synthetic metrics

| Metric | Baseline | Incident |
|---|---:|---:|
| API p95 | 220 ms | 4.1 s |
| API 5xx/timeout | 0.2% | 4.7% |
| DB CPU | 35% | 31% |
| DB connections | 45 | 58 |
| Active queries | 9 | 14 |
| Lock waiters | 0–1 | 11 |
| Lock wait p95 | 15 ms | 3.2 s |
| Transaction duration p95 | 120 ms | 8.6 s |

## 1. Impact & scope

Зафиксируй:
- affected endpoint, метод и бизнес-функцию;
- scope: конкретные order IDs (не записывай реальные PII в incident notes), tenant или workflow;
- время начала и сопоставление с release;
- error rate, latency, количество запросов;
- все ли replicas orders-service затронуты;
- работает ли read-only endpoint и другие функции.

Не пытайся воспроизводить проблему на реальных пользовательских данных.

## 2. Kubernetes read-only checks

```bash
kubectl config current-context
kubectl get deploy,pods,svc -n <namespace> -o wide
kubectl get events -n <namespace> --sort-by=.lastTimestamp
kubectl logs deployment/<orders-deployment> -n <namespace> --since=20m --timestamps
```

Проверь rollout/version, Pod Ready/restarts, application timeout/error logs, connection pool metrics (active, idle, pending, acquisition time), недавние changes. Kubernetes events не показывают PostgreSQL lock graph. Healthy Pods не означают, что SQL запросы выполняются без ожиданий.

## 3. PostgreSQL read-only investigation

Проводить на согласованном monitoring connection, с минимальным выводом и разрешёнными правами. Проверяй PostgreSQL version и соответствие колонок pg_stat_activity.

### Сколько сессий ждёт lock

```sql
SELECT
    wait_event_type,
    wait_event,
    state,
    count(*) AS sessions
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
GROUP BY wait_event_type, wait_event, state
ORDER BY sessions DESC;
```

### Состояние и возраст транзакций — без query text

```sql
SELECT
    pid,
    application_name,
    state,
    wait_event_type,
    wait_event,
    clock_timestamp() - xact_start AS transaction_age,
    clock_timestamp() - query_start AS query_age
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start
LIMIT 30;
```

**Не копируй query text, bind values, credentials или sensitive data в отчёт.** PID — временный диагностический идентификатор; не используй его для terminate без отдельной проверки ownership и approval.

### Найти blockers и blocked sessions

В PostgreSQL versions, где доступна pg_blocking_pids(), можно использовать read-only запрос:

```sql
SELECT
    blocked.pid AS blocked_pid,
    blocked.application_name AS blocked_app,
    blocked.wait_event,
    clock_timestamp() - blocked.query_start AS blocked_query_age,
    blocker.pid AS blocker_pid,
    blocker.application_name AS blocker_app,
    blocker.state AS blocker_state,
    clock_timestamp() - blocker.xact_start AS blocker_xact_age
FROM pg_stat_activity AS blocked
CROSS JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS blocking_pid
JOIN pg_stat_activity AS blocker ON blocker.pid = blocking_pid
WHERE blocked.wait_event_type = 'Lock'
ORDER BY blocked.query_start;
```

Этот запрос показывает relationships, но сам по себе не объясняет, какой application workflow держит lock и почему. pg_blocking_pids() требует подходящей версии PostgreSQL. Проверь privileges и workload impact перед выполнением.

### Lock catalog overview

Для учебной среды можно смотреть агрегаты по pg_locks, не выгружая все детали в публичный отчёт:

```sql
SELECT
    locktype,
    mode,
    granted,
    count(*) AS locks
FROM pg_locks
GROUP BY locktype, mode, granted
ORDER BY granted, locks DESC;
```

Не пытайся анализировать всю таблицу locks вручную без привязки к blocked sessions и конкретной транзакции.

## Evidence A — synthetic snapshot

```text
PostgreSQL connections: 58/100
Active sessions: 14
Sessions waiting on Lock: 11
DB CPU: 31%
Blocked query age (p95): 3.2s
```

## Evidence B — synthetic blocker relationship

```text
blocked_pid  blocked_app    wait_event       query_age
4121         orders-api     transactionid   4.2s
4127         orders-api     transactionid   3.9s
4132         orders-api     transactionid   3.7s
4138         orders-api     transactionid   3.4s
4144         orders-api     transactionid   3.1s

blocker_pid  blocker_app    blocker_state    transaction_age
3980         orders-api     idle in transaction  6m 12s
```

Здесь blocker session длительное время idle in transaction. Она может удерживать locks, хотя прямо сейчас не выполняет SQL. Не делай вывод по одному состоянию: idle in transaction не всегда означает, что session блокирует другие транзакции. Подтверди blocker relationship через blocking function и соответствующие lock evidence.

## Evidence C — application logs

```text
10:18:02.101 request_id=ord-a72c INFO updating order status
10:18:02.103 request_id=ord-a72c WARN DB statement waiting; timeout=4000ms
10:18:06.105 request_id=ord-a72c ERROR transaction failed: lock timeout
10:18:06.107 request_id=ord-a72c WARN request rolled back

10:18:07.412 request_id=ord-a72d INFO updating order status
10:18:11.416 request_id=ord-a72d ERROR lock wait timeout
```

## Evidence D — timeline correlation

```text
10:06 release orders-service
10:09 new workflow starts transactions that remain open
10:12 lock waiters increase
10:15 API p95 begins rising
10:18 first lock timeout
10:22 alert fires
```

## 4. Различи lock contention, deadlock и slow query

| Тип проблемы | Признаки | Что подтверждать |
|---|---|---|
| Lock contention | Sessions waiting for Lock, blocker graph, long-held transaction | Blocking relationship, lock holder, transaction age |
| Deadlock | PostgreSQL detects cycle, one transaction aborted, deadlock error/log | DB deadlock report with involved transactions; review lock acquisition order |
| Slow query | Query itself long; wait may be none or I/O/CPU-related | Query latency, plan review, I/O, CPU, query stats |
| Connection pool saturation | Application pending/acquire timeouts, pool active at max | Pool metrics; DB connections and states; whether slots are held or unavailable |
| DB CPU saturation | CPU high, workload active, latency correlates | DB CPU, active queries, workload profile |
| External dependency delay while transaction open | Long transaction duration and connection/lock retained across external wait | Trace/log timeline and code path, transaction boundaries |

Lock wait can be caused by a blocker doing work, by an open transaction that's idle, or by a complex chain. A deadlock is a cycle; ordinary blocking is not necessarily deadlock. PostgreSQL detects deadlocks and aborts one transaction to break the cycle, so clients may observe errors even if the DB recovers automatically.

## 5. Hypotheses

Rank and test them with evidence:
- New release holds transaction/row lock longer than before.
- A workflow calls an external service while inside an open transaction.
- Two code paths acquire locks in different orders (possible deadlock).
- A specific query became slow and holds a lock.
- Batch job overlaps with user traffic.
- Application retries amplify blocked requests.
- Connection pool is too small (may explain application symptoms but not necessarily the DB blocker).

For each: evidence for, evidence against, next safe check. Don't terminate sessions to see if the issue goes away.

## 6. Root cause — spoiler

<details>
<summary>Скрытая подсказка</summary>

Сопоставь release, transaction age, blocked sessions и blocker state. Кто держит lock, если blocker сейчас idle?

</details>

<details>
<summary>Root cause</summary>

Новый workflow в orders-service открывает transaction и обновляет запись заказа, затем делает внешний HTTP call до завершения transaction. Во время медленного ответа внешнего API transaction остаётся открытой и удерживает row lock. Другие запросы, пытающиеся обновить связанные данные, ждут blocker. Число blocked requests растёт, latency и lock timeout на API увеличиваются, хотя PostgreSQL CPU и connection count не экстремальны.

В evidence blocker — session idle in transaction, длительность transaction больше нескольких минут; pg_blocking_pids() связывает с ней blocked sessions. Это не deadlock: подтверждённая blocking chain не образует cycle, PostgreSQL не сообщает deadlock victim. Root cause — transaction scope regression в application workflow.

</details>

## 7. Mitigation plan — не выполняй автоматически

После подтверждения:
1. Определи owner blocker session и связанный application workflow.
2. Оцени rollback/feature disable для релиза, если это безопасно и совместимо с schema/data changes.
3. Если конкретная transaction требует завершения, это действие DBA/owner по согласованному процессу: evaluate side effects, rollback work, transaction state. Не запускай pg_terminate_backend самостоятельно.
4. Не увеличивай lock timeout: это может заставить больше запросов ждать.
5. Не увеличивай connection pool: дополнительные соединения могут добавить blocked sessions.
6. Не перезапускай DB или Pods без доказательства, что это решит проблему.
7. Если возможен batch/job contention, согласуй ограничение или pause job по operational process.

## 8. Verification

После mitigation:
- blocked sessions и lock waiters уменьшаются;
- blocker transaction завершена/устранена, lock освобождён;
- lock wait p95 возвращается к baseline;
- API p95 и error rate снижаются;
- connection pool pending/acquire timeout уменьшается;
- проверен business workflow в approved environment;
- убедись, что инцидент не повторяется при нормальной нагрузке.

Не считать успешным verification только отсутствие deadlock message — lock contention мог остаться.

## 9. Prevention

Предложи меры:
- сокращать transaction scope, не держать transaction во время external HTTP calls;
- фиксировать consistent lock acquisition order во всех workflow;
- review transaction boundaries и ORM behavior;
- ограничивать batch concurrency и разводить расписание batch/user workloads;
- monitor blocked session count, lock wait duration, oldest transaction age;
- alert по росту blocked transactions и latency;
- нагрузочные тесты сценариев concurrent updates;
- bounded retries с backoff/jitter, idempotency;
- incident runbook с DBA escalation и safe query templates.

## Incident report

- **Impact:**
- **Timeline:**
- **Evidence:** blocked PIDs/relationship (sanitized), wait type, transaction age, app logs, metrics.
- **Hypotheses:**
- **Root cause:**
- **Mitigation approval/owner:**
- **Verification:**
- **Prevention/follow-up:**

## Шпаргалка

| Признак | Check |
|---|---|
| wait_event_type = Lock | Blocking sessions, pg_blocking_pids(), transaction age |
| Many blocked, CPU low | Find blocker; DB may wait rather than compute |
| idle in transaction | Inspect age, ownership, blocking evidence; not automatically a blocker |
| Deadlock error | DB deadlock log/report; cycle; lock acquisition order |
| Query slow, no lock wait | Query plan/stats, IO, CPU, downstream wait |
| API pool pending | Pool active/idle/pending/acquire timeout; connection lifecycle |
| Lock waits after release | Correlate change/time, transaction boundary, workflow |

## Критерии прохождения

- [ ] Различаю lock contention и deadlock.
- [ ] Не делаю вывод по одному idle in transaction.
- [ ] Использую read-only pg_stat_activity, pg_blocking_pids(), pg_locks с безопасным выводом.
- [ ] Нахожу blocking session и подтверждаю relationship.
- [ ] Сопоставляю lock wait с application logs и release timeline.
- [ ] Отличаю locks от slow query, DB CPU saturation и pool exhaustion.
- [ ] Не выполняю terminate/kill и не меняю timeout/pool без approval.
- [ ] Формирую mitigation, verification и prevention plan.
