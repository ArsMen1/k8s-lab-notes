# Lab: Java API — latency, thread pool и исчерпание ресурсов

**Цель:** расследовать деградацию Java API по симптомам и evidence, используя read-only диагностику Kubernetes и JVM. Не перезапускай Pod и не меняй лимиты/настройки до фиксации исходных данных.

## Сценарий

После релиза пользователи жалуются: запросы к API стали медленными, часть запросов завершается HTTP 503/504. Pod остаются `Running`, readiness probe проходит. CPU и память на дашборде не выглядят критичными. Количество реплик не изменилось.

Тебе передали выдержки из мониторинга и thread dump. Нужно установить, на каком слое возникает задержка и предложить безопасную mitigation.

## Симптомы и исходные данные

Наблюдения за последние 15 минут:

| Метрика | До инцидента | Сейчас |
|---|---:|---:|
| p95 latency | 180 ms | 8.4 s |
| HTTP 5xx | < 0.2% | 7.8% |
| CPU container | 35–45% | 38–52% |
| Memory working set | 620 MiB | 655 MiB |
| Ready replicas | 3/3 | 3/3 |
| Pod restarts | 0 | 0 |

В логах встречаются сообщения:

```text
WARN  Request timed out while waiting for a resource
ERROR Failed to process request: upstream operation timeout
```

## Задания

1. Сформулируй impact и timeline. Что известно, а что пока только гипотеза?
2. Проверь context, namespace, deployment, Pods, Events, probes и недавние изменения.
3. Сопоставь latency, 5xx, CPU, memory и число реплик. Почему эти метрики не исключают проблем внутри приложения?
4. Изучи thread dump excerpts ниже. Определи, какие состояния потоков преобладают и что они ожидают.
5. Найди признаки возможного исчерпания thread pool, connection pool, блокировок или медленной зависимости.
6. Сформулируй минимум три гипотезы и критерии, по которым их можно проверить/отвергнуть.
7. Назови безопасные read-only проверки, которые можно выполнить в production.
8. Предложи mitigation, но не выбирай её до определения риска и подтверждения.
9. Определи verification: какие метрики/логи должны измениться и сколько времени наблюдать?
10. Подготовь краткий incident report.

## Read-only диагностика Kubernetes

Сначала убедись, что работаешь в правильном контексте.

```bash
kubectl config current-context
kubectl get deploy,pod -n <namespace> -o wide
kubectl describe deploy <deployment> -n <namespace>
kubectl describe pod <pod> -n <namespace>
kubectl logs <pod> -n <namespace> --since=30m --timestamps
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl top pod -n <namespace> --containers
```

Проверь конфигурацию workload, не раскрывая секреты:

```bash
kubectl get deployment <deployment> -n <namespace> -o yaml
kubectl get pod <pod> -n <namespace> -o jsonpath='{.spec.containers[*].resources}'
kubectl get pod <pod> -n <namespace> -o jsonpath='{.status.containerStatuses[*].restartCount}'
```

Если есть разрешённый доступ внутрь контейнера и JVM tooling доступен, запросы к JVM выполняй только с согласованными правами. Не устанавливай инструменты в production container и не запускай диагностические команды с неизвестной нагрузкой.

Примеры (только если доступны и разрешены):

```bash
jcmd <pid> Thread.print
jcmd <pid> VM.command_line
```

Thread dump может содержать чувствительные данные. Не прикладывай его целиком к тикету/публичному каналу без очистки.

## Evidence A — Thread dump excerpts

Это синтетические выдержки, созданные для лаборатории, а не реальные логи.

### HTTP worker threads

```text
"http-nio-8080-exec-21" #184 daemon prio=5 os_prio=0 tid=0x00007f... WAITING
   java.lang.Thread.State: WAITING (parking)
   at jdk.internal.misc.Unsafe.park(Native Method)
   at java.util.concurrent.locks.LockSupport.park(LockSupport.java:211)
   at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:...)
   at com.zaxxer.hikari.HikariDataSource.getConnection(HikariDataSource.java:...)
   at com.example.orders.repository.OrderRepository.findById(OrderRepository.java:...)
   at com.example.orders.service.OrderService.getOrder(OrderService.java:...)
   at com.example.orders.controller.OrderController.getOrder(OrderController.java:...)
```

### Другой HTTP worker

```text
"http-nio-8080-exec-22" #185 daemon prio=5 os_prio=0 tid=0x00007f... WAITING
   java.lang.Thread.State: WAITING (parking)
   at jdk.internal.misc.Unsafe.park(Native Method)
   at java.util.concurrent.locks.LockSupport.park(LockSupport.java:211)
   at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:...)
   at com.zaxxer.hikari.HikariDataSource.getConnection(HikariDataSource.java:...)
   at com.example.orders.repository.OrderRepository.listRecent(OrderRepository.java:...)
   at com.example.orders.service.OrderService.listOrders(OrderService.java:...)
   at com.example.orders.controller.OrderController.listOrders(OrderController.java:...)
```

### Пример потока, выполняющего запрос

```text
"db-query-worker-3" #91 daemon prio=5 os_prio=0 tid=0x00007f... RUNNABLE
   java.lang.Thread.State: RUNNABLE
   at org.postgresql.core.PGStream.receiveChar(Native Method)
   at org.postgresql.core.VisibleBufferedInputStream.read(VisibleBufferedInputStream.java:...)
   at org.postgresql.core.v3.QueryExecutorImpl.processResults(QueryExecutorImpl.java:...)
   at org.postgresql.core.v3.QueryExecutorImpl.execute(QueryExecutorImpl.java:...)
   at org.postgresql.jdbc.PgStatement.executeInternal(PgStatement.java:...)
   at org.postgresql.jdbc.PgPreparedStatement.executeQuery(PgPreparedStatement.java:...)
   at com.example.orders.repository.OrderRepository.findById(OrderRepository.java:...)
```

`RUNNABLE` в JVM dump не обязательно означает, что поток активно потребляет CPU: он может находиться в native I/O и ожидать данные. Не делай вывод только по state.

## Evidence B — метрики пула соединений (synthetic)

| Метрика | Значение |
|---|---:|
| maximumPoolSize | 10 |
| active connections | 10 |
| idle connections | 0 |
| pending threads | 26 |
| connection acquisition timeout | 2 s |
| median query duration | 140 ms |
| p95 query duration | 6.7 s |

Эти цифры сами по себе не объясняют, почему запросы к БД замедлились. Продолжи расследование: ищи correlation по времени, конкретным query/endpoint, DB wait/locks, нагрузке и изменениям.

## Evidence C — Что проверить дальше

### На уровне приложения
- Сколько HTTP threads, active/pending requests, queue depth и rejected tasks?
- Как менялись pool sizes, connection timeout, query timeout и retry policy в релизе?
- Не запускаются ли повторные запросы (retry storm), не увеличивая нагрузку на dependency?
- Есть ли несколько thread dumps с интервалом 10–15 секунд, и совпадают ли stacks?

### На уровне БД (через согласованные read-only средства)
- Connection count, saturation и wait events.
- Long-running queries и блокирующие транзакции.
- Locks / deadlocks, если их диагностика доступна.
- Query plan и статистика — только в рамках полномочий и без запуска потенциально тяжёлых запросов.

### На уровне Kubernetes
- Container limits/requests, throttling и OOM/eviction events.
- Изменения replicas, deployment revision, config/secret references (без вывода Secret values).
- Network errors, DNS и connectivity, если evidence указывает на это.

## Root cause (открывай после расследования)

<details>
<summary>Разбор</summary>

**Root cause в этом сценарии:** резкое увеличение времени выполнения SQL-запросов/ожидания на стороне PostgreSQL привело к тому, что все 10 соединений HikariCP оказались заняты. Новые HTTP worker threads ожидали получения connection из пула. Из-за этого росло время ответа, очередь ожидания и количество 5xx/timeout, хотя CPU и memory оставались относительно нормальными.

Thread dump показывает место ожидания (получение соединения), а pool metrics подтверждают saturation. Эти данные **не доказывают первопричину медленной БД**: нужно отдельно подтвердить DB-side cause (например, lock, изменившийся query plan, рост нагрузки, I/O или деградация dependency).

</details>

## Безопасная mitigation — выбирай после подтверждения

В зависимости от установленной причины, согласуй одну из мер:
- Устранить DB-side blocker / восстановить dependency, если это подтверждённая причина.
- Откатить релиз, если временная корреляция и diff указывают на регрессию.
- Ограничить или временно отключить конкретный проблемный endpoint/операцию по согласованному runbook.
- Корректировать pool size только после оценки capacity БД. Увеличение пула может усилить нагрузку и ухудшить инцидент.
- Не делай массовый restart Pods как первичное лечение: он не исправит медленные запросы и может увеличить нагрузку при восстановлении.

## Verification

После mitigation отслеживай в динамике:
- p95/p99 latency и error rate по API;
- connection pool active/idle/pending и acquisition timeouts;
- DB query duration, waits/locks и нагрузку;
- HTTP thread pool utilization, очередь и rejected tasks;
- состояние Ready endpoints и отсутствие новых рестартов.

Сравни с baseline, а не только с единичным удачным запросом. Проверь несколько минут стабильности и убедись, что восстановление не вызвало вторичную нагрузку.

## Incident report

Заполни:

- **Impact:** какие запросы/пользователи пострадали?
- **Timeline:** когда началась деградация, какие изменения предшествовали?
- **Evidence:** метрики, thread dumps, pool stats, DB observations.
- **Hypotheses:** какие версии проверил и чем отверг?
- **Root cause:** подтверждённая причина задержки на DB-side.
- **Mitigation:** что изменил и почему это безопасно?
- **Validation:** какие метрики восстановились и как долго наблюдал?
- **Prevention:** алерты на pool pending/acquisition timeout, DB waits/query latency, capacity и release regression checks.

## Cleanup

Лаборатория не требует создания ресурсов Kubernetes. Ничего удалять не нужно.

---

## Дополнительная шпаргалка

- `WAITING` на `HikariPool.getConnection()` — поток ожидает свободное соединение, а не выполняет SQL в этом stack.
- `RUNNABLE` в JDBC stack — не обязательно означает высокий CPU; смотри CPU metrics и повторные dumps.
- Saturated pool — симптом/механизм деградации, а не автоматически root cause.
- Не увеличивай DB pool без оценки общей concurrency и лимитов PostgreSQL.
- Thread dump лучше сравнивать во времени; единичный dump показывает snapshot, но не динамику.
