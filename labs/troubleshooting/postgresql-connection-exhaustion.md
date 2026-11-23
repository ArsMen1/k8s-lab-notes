# PostgreSQL: connection exhaustion при нормальном CPU

## Сценарий

API начинает отвечать медленно и выдавать timeout. Приложение сообщает, что не может получить соединение с PostgreSQL. При этом CPU базы невысокий, активных тяжёлых запросов почти нет, Pods Kubernetes выглядят healthy.

Твоя задача — определить, почему connection slots исчерпаны, отличить connection saturation от CPU/query saturation и предложить безопасное восстановление.

## Симптомы

| Метрика | Baseline | Сейчас |
|---|---:|---:|
| Application p95 | 160 ms | 5.6 s |
| HTTP 5xx / timeout | 0.1% | 9.1% |
| PostgreSQL CPU | 38% | 24% |
| PostgreSQL memory | 62% | 64% |
| Connections used | 42/100 | 98/100 |
| Active queries | 12 | 8 |
| Idle in transaction | 2 | 68 |
| Longest transaction age | 14 s | 37 min |
| App pool active / max (per Pod) | 8/20 | 20/20 |
| Pods Ready | 5/5 | 5/5 |

PostgreSQL доступен по сети. Kubernetes Pods не перезапускались. CPU PostgreSQL снизился, но API стал хуже.

## Ограничения

- Проверь kubectl context и namespace.
- Используй read-only запросы и наблюдения.
- Не перезапускай PostgreSQL и application Pods без согласованного change.
- Не выполняй pg_terminate_backend, массовый kill sessions, VACUUM FULL, изменение max_connections или rollout приложения без обоснования и approval.
- Не выводи query text, параметры, credentials или персональные данные в отчёт.
- Учебные SQL snippets предполагают PostgreSQL; проверь версию, permissions и согласованный monitoring endpoint.

## Задание 1 — impact и timeline

1. Оцени impact: какие запросы затронуты, какой процент ошибок, когда началась деградация?
2. Сопоставь connection count, CPU, active queries и idle-in-transaction.
3. Почему низкий CPU не означает, что база здорова?
4. Какие симптомы являются следствием, а какие могут быть первопричиной?

## Задание 2 — Kubernetes read-only

    kubectl config current-context
    kubectl get deploy,pod -n <namespace> -o wide
    kubectl describe deployment <api-deployment> -n <namespace>
    kubectl describe pod <api-pod> -n <namespace>
    kubectl logs <api-pod> -n <namespace> --since=30m --timestamps
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
    kubectl top pods -n <namespace> --containers

Проверь:
- рестарты, probes, rollout history, resource limits;
- сколько реплик API работает и сколько соединений pool может создать каждая;
- параметры pool: max size, acquisition timeout, idle timeout, max lifetime (через разрешённую конфигурацию, не выводя Secret);
- retry policy — не увеличивает ли она давление на DB;
- недавние deployment/config changes.

**Вопрос:** если 5 Pods и pool size 20, какую максимальную теоретическую нагрузку connections может создать приложение? Что ещё может использовать connection slots?

## Задание 3 — PostgreSQL read-only investigation

Через согласованный read-only мониторинг проверь connection states, длительность транзакций и waits. Пример запросов для учебной среды (ограничь вывод и не раскрывай query text):

### Состояния подключений

    SELECT state, count(*)
    FROM pg_stat_activity
    GROUP BY state
    ORDER BY count(*) DESC;

### Возраст транзакций и состояния (без SQL text)

    SELECT
      state,
      count(*) AS sessions,
      max(clock_timestamp() - xact_start) AS oldest_xact_age,
      max(clock_timestamp() - state_change) AS oldest_state_age
    FROM pg_stat_activity
    WHERE xact_start IS NOT NULL
    GROUP BY state
    ORDER BY sessions DESC;

В реальной среде адаптируй запрос под PostgreSQL version, права и approved monitoring. Избегай выгрузки полного pg_stat_activity, где query text может содержать sensitive information.

Проверь:
- число sessions по states;
- idle in transaction count и возраст;
- active queries, wait events и длительность;
- connection count vs max_connections и reserved slots;
- DB logs: connection refused / remaining connection slots / timeout (с редактированием sensitive details);
- совпадают ли время появления idle-in-transaction и release timeline.

Не запускай тяжёлые дополнительные запросы на production ради расследования.

## Evidence A — Synthetic PostgreSQL snapshot

    max_connections: 100
    current_connections: 98
    active: 8
    idle: 22
    idle_in_transaction: 68
    oldest_idle_in_transaction: 37 minutes
    waiting_for_lock: 2
    CPU: 24%

## Evidence B — Application logs (synthetic)

    WARN  HikariPool-1 - Connection is not available, request timed out after 2000ms
    ERROR order request failed: could not acquire database connection
    WARN  Transaction remains open while waiting for downstream response
    WARN  Connection acquisition timeout

## Evidence C — Release timeline (synthetic)

    09:30 — deployment completed
    09:36 — idle-in-transaction connections begin increasing
    09:42 — application pool active reaches max
    09:45 — API p95 crosses 1 second
    09:48 — connection acquisition timeout rate rises
    09:52 — PostgreSQL connection count reaches 98/100

## Evidence D — Correlation

| Signal | Observation |
|---|---|
| DB CPU | Low/moderate |
| Active query count | Low |
| Idle-in-transaction | High and growing |
| Transaction age | Tens of minutes |
| App pool | Saturated |
| Connection errors | Rising |
| Release timing | Matches start of issue |

## Задание 4 — гипотезы

Ранжируй возможные причины:

- connection leak;
- long-running transaction;
- transaction held open during external API call;
- connection pool configured too small;
- DB max_connections reached from multiple services;
- lock contention;
- slow queries;
- connection storm caused by retries.

Для каждой гипотезы запиши evidence за/против и следующий безопасный check. Не считай idle in transaction автоматически доказательством leak: выясни, какой код или workflow удерживает транзакцию.

## Задание 5 — Root cause

Составь объяснение причинно-следственной цепочки:
1. Что изменилось в приложении?
2. Почему соединения оставались заняты?
3. Почему PostgreSQL CPU был невысоким?
4. Почему application pool и API начали выдавать timeout?
5. Почему простое увеличение max_connections может отсрочить, но не устранить инцидент?

## Safe mitigation

Подготовь mitigation plan:

- Если regression подтверждён, оцени согласованный rollback или отключение проблемного feature.
- Уменьши или останови поток создания новых зависших транзакций, если есть безопасный operational switch.
- Не убивай сессии массово. Терминация конкретных backend sessions — только по подтверждённому ownership, оценке последствий и approval.
- Не увеличивай pool size автоматически: это может увеличить DB load и количество открытых connections.
- Не повышай max_connections без оценки RAM, workload, резервных подключений и планирования.
- Не устраивай retry storm; retries должны быть bounded, с backoff и jitter.
- Согласуй коммуникацию с DBA и владельцем сервиса.

## Verification

После mitigation следи за trend и подтверждай восстановление:

- idle-in-transaction count снижается;
- oldest transaction age сокращается;
- connection count освобождается и стабилизируется;
- app pool active/pending возвращается к норме;
- connection acquisition timeout исчезает;
- p95 и 5xx API снижаются;
- DB CPU, locks и throughput не ухудшаются;
- бизнес-функции проверены без повторной перегрузки.

## Incident report

- **Impact:**
- **Detection:**
- **Timeline:**
- **Evidence:**
- **Root cause:**
- **Mitigation:**
- **Verification:**
- **Prevention:**
- **Follow-up owner:**

## Root cause — открой после расследования

<details>
<summary>Подсказка</summary>

Сравни release timeline и количество idle in transaction. Подумай, что произойдёт, если код откроет transaction, а затем вызовет внешний сервис, который отвечает медленно или зависает.

</details>

<details>
<summary>Root cause</summary>

В релизе появился workflow, который удерживает DB transaction/connection открытым во время ожидания ответа внешнего API. При деградации внешней зависимости время ожидания выросло, и множество транзакций оставались открытыми, хотя PostgreSQL не выполнял тяжёлую работу.

Connections удерживались, не освобождая slots. Application connection pools постепенно насыщались, новые запросы ожидали получения соединения и завершались timeout. Это объясняет сочетание низкого DB CPU, малого числа active queries, большого количества idle-in-transaction и насыщенных application pools.

**Mitigation:** rollback или отключение изменённого workflow, если это согласовано и подтверждено. Дождаться освобождения соединений, контролируя metrics. Не терминировать sessions вслепую.

**Prevention:** не удерживать транзакции открытыми во время сетевых вызовов; сократить transaction scope; добавить transaction timeout/idle-in-transaction timeout с осторожной настройкой; тестировать dependency failure; мониторить connection states, pool wait time, oldest transaction age; review кода и release checklist.

</details>

## Cleanup

Лаборатория использует synthetic evidence; cleanup не нужен. Если ты создавал собственные resources, удали только ресурсы своей лаборатории после проверки context и namespace.

## Краткая шпаргалка

| Симптом | Куда смотреть |
|---|---|
| Connections почти исчерпаны, CPU низкий | pg_stat_activity, idle-in-transaction, connection pool |
| Active queries много и CPU высокий | Query performance, plans, workload |
| Idle in transaction растёт | Transaction scope, application code, external calls |
| App pool saturated, DB connection count высокий | Pool metrics, connection ownership, leaks |
| Connection errors после release | Config/code regression, retry policy, connection lifecycle |
| Увеличение pool не помогает | DB slots, long-held connections, downstream bottleneck |
