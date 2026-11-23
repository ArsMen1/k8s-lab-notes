# Lab: Kafka consumer lag растёт, сообщения не успевают обрабатываться

**Цель:** расследовать отставание Kafka consumer group, определить bottleneck по метрикам и логам, выбрать безопасную mitigation и проверить восстановление без потери сообщений.

## Сценарий

В production команда получает alert: consumer group `orders-enrichment` отстаёт от topic `orders`. Входящий поток сообщений увеличился, но пользователи пока не видят массовой потери данных. В downstream-сервисе появились задержки обработки заказов.

Не начинай с увеличения количества consumers или сброса offsets. Сначала установи, что именно происходит: рост producer rate, недостаточная скорость обработки, зависание, ошибки, rebalance или проблема downstream dependency.

## Симптомы

Сводка за последние 20 минут (данные синтетические):

| Метрика | До инцидента | Сейчас |
|---|---:|---:|
| Producer rate | 900 msg/s | 1,050 msg/s |
| Consumer processing rate | 930 msg/s | 620 msg/s |
| Consumer group lag | 0–300 | 48,000 и растёт |
| Active consumers | 6 | 6 |
| Topic partitions | 12 | 12 |
| Rebalance frequency | 0–1/hour | без изменений |
| Consumer error rate | <0.1% | 3.2% |
| Processing p95 | 90 ms | 1.8 s |

В application logs встречаются сообщения:

```text
WARN enrichment request timed out; retrying
WARN message processing exceeded configured timeout
ERROR failed to enrich order after retries
```

Это симптомы, а не root cause. Ошибки могут приводить к retry, повторной обработке, задержкам commit и увеличению lag.

## Задания

1. Опиши impact: какие операции задерживаются, какой scope, с какого времени?
2. Проверь cluster/context и namespace, в котором работают Kafka и consumers.
3. Сопоставь producer rate, consumer processing rate, lag, error rate и processing latency.
4. Определи, lag растёт равномерно или только на отдельных partitions.
5. Проверь consumer group state, assignments, committed offsets и partition end offsets.
6. Установи, есть ли rebalance, consumer churn, ошибки commit, обработка сообщений медленнее поступления или downstream bottleneck.
7. Сформулируй минимум 3 гипотезы и evidence для подтверждения/отвержения каждой.
8. Предложи безопасную mitigation с учетом порядка сообщений, partitioning, retries и downstream capacity.
9. Определи критерии verification и возможные риски восстановления.
10. Составь incident report.

## Read-only диагностика Kubernetes

Начни с правильного context и namespace:

```bash
kubectl config current-context
kubectl get deploy,pod -n <namespace> -o wide
kubectl describe deploy <consumer-deployment> -n <namespace>
kubectl describe pod <consumer-pod> -n <namespace>
kubectl logs <consumer-pod> -n <namespace> --since=30m --timestamps
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl top pod -n <namespace> --containers
```

Проверь rollout/revision и конфигурацию без вывода credentials или Secret data:

```bash
kubectl rollout history deployment/<consumer-deployment> -n <namespace>
kubectl get deployment <consumer-deployment> -n <namespace> -o yaml
```

Если workload управляется не Deployment (например, StatefulSet или operator), адаптируй проверки. Не запускай rollout restart, scale или удаление Pods как диагностический первый шаг.

## Kafka: read-only checks

Используй Kafka CLI, доступный в вашей среде, и подходящую bootstrap address. CLI options могут отличаться в зависимости от версии и security setup. Не передавай credentials в shell history, вывод команд или тикет.

### Consumer group status

```bash
kafka-consumer-groups.sh \
  --bootstrap-server <bootstrap-server> \
  --group orders-enrichment \
  --describe
```

Смотри по каждой partition:
- CURRENT-OFFSET;
- LOG-END-OFFSET;
- LAG;
- CONSUMER-ID / HOST / CLIENT-ID;
- наличие assignments и распределение partitions между consumers.

### Topic partition metadata

```bash
kafka-topics.sh \
  --bootstrap-server <bootstrap-server> \
  --describe \
  --topic orders
```

Сопоставь число partitions, replication, лидеров и ISR. Не меняй partition count или replication factor в рамках диагностики.

### Consumer group state (если поддерживается версией CLI)

```bash
kafka-consumer-groups.sh \
  --bootstrap-server <bootstrap-server> \
  --group orders-enrichment \
  --describe \
  --state
```

Дополнительно изучи метрики consumer: records consumed rate, fetch rate/latency, commit rate/latency, poll interval, heartbeat, assigned partitions, rebalance count, processing time и retry count. Набор метрик зависит от клиента (Java, librdkafka и др.) и instrumentation.

## Evidence A — Consumer group summary (synthetic)

```text
GROUP              TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
orders-enrichment  orders  0         184200          188400          4200
orders-enrichment  orders  1         171300          175700          4400
orders-enrichment  orders  2         195000          199100          4100
orders-enrichment  orders  3         161800          166300          4500
orders-enrichment  orders  4         201400          205500          4100
orders-enrichment  orders  5         178900          183000          4100
orders-enrichment  orders  6         190500          194700          4200
orders-enrichment  orders  7         165300          169500          4200
orders-enrichment  orders  8         199100          203300          4200
orders-enrichment  orders  9         176800          181000          4200
orders-enrichment  orders  10        187600          191900          4300
orders-enrichment  orders  11        172200          176400          4200
```

Lag распределен почти равномерно по partitions. Это не исключает partition-specific проблем, но заставляет проверить общий processing bottleneck и dependency.

## Evidence B — Consumer metrics (synthetic)

| Metric | Value |
|---|---:|
| Consumers in group | 6 |
| Assigned partitions | 2 per consumer |
| Poll loop | active |
| Heartbeat failures | 0 |
| Rebalance count | baseline |
| Processing rate | 620 msg/s |
| Producer rate | 1,050 msg/s |
| Retry count | elevated |
| Processing p95 | 1.8 s |

Проверь, не путаешь message poll activity с фактической бизнес-обработкой и committed offsets. Consumer может успешно poll, но медленно обрабатывать records или commit offsets.

## Evidence C — Application logs (synthetic)

```text
12:03:11.204 WARN order=... enrichment call timed out after 1500 ms
12:03:12.705 WARN order=... retry attempt=1
12:03:14.206 WARN order=... enrichment call timed out after 1500 ms
12:03:15.707 ERROR order=... enrichment failed after retry attempts=2
12:03:15.708 WARN consumer processing duration=3290 ms
```

Не публикуй order IDs, customer data, tokens, headers или payloads в incident channel. В этом exercise идентификаторы обезличены.

## Evidence D — Downstream dependency (synthetic)

| Метрика | До | Сейчас |
|---|---:|---:|
| Enrichment API p95 | 120 ms | 2.2 s |
| Enrichment API timeout rate | 0.05% | 12% |
| Consumer retry attempts | baseline | заметно выше |
| Kafka broker health | normal | normal |

Kafka brokers здоровы. Lag — это backlog на стороне consumer group; он не означает автоматически, что Kafka broker malfunction.

## Гипотезы для проверки

| Гипотеза | Что проверить |
|---|---|
| Producer traffic резко вырос | Producer rate, records per partition, traffic pattern и сравнение с baseline |
| Consumer недостаточно быстрый | Processing rate, per-record duration, consumer CPU, poll/commit metrics |
| Downstream dependency замедлилась | API latency/timeouts, retries, dependency alerts, корреляция времени |
| Consumers теряют membership / rebalance | Group state, rebalance metrics, heartbeat, logs |
| Несколько partitions имеют hot keys | Lag по partitions, key distribution, processing duration per partition |
| Ошибки commit или offset management | Commit rate/errors, committed offset vs end offset, client logs |

Не считай гипотезу подтвержденной, пока evidence не согласуется.

## Root cause (открывай после самостоятельного расследования)

<details>
<summary>Разбор</summary>

**Root cause сценария:** downstream enrichment API резко замедлился и стал чаще отвечать timeout. Consumer синхронно вызывает API для каждой message, делает retry, и поэтому тратит существенно больше времени на обработку одной записи. Processing rate упал ниже producer rate, из-за чего lag растет.

Kafka broker health нормален; увеличение числа consumers не обязательно поможет, если dependency уже перегружена. Более высокая concurrency может увеличить давление на API, усилить retry storm и ухудшить ситуацию.

</details>

## Безопасная mitigation

Выбирай только после подтверждения:

- Согласовать восстановление downstream API с его владельцами.
- При подтвержденной регрессии — рассмотреть rollback consumer release/config через change process.
- Если предусмотрено архитектурой, временно ограничить/приостановить retry или обработку проблемного типа records согласно runbook (не теряя messages и не нарушая delivery guarantees).
- Рассмотреть controlled scaling consumers **только** если downstream capacity позволяет, partitions достаточно, и нет риска дополнительного перегруза.
- Если применяется DLQ, проверить критерии, порядок обработки, retry policy, idempotency и процедуру replay. Не перемещай сообщения в DLQ произвольно.
- Не сбрасывай consumer offsets, не удаляй topic, не меняй retention и не отключай consumer group в качестве первого действия.

## Verification

После mitigation наблюдай:
- consumer processing rate устойчиво выше incoming producer rate (или backlog начинает уменьшаться);
- total lag и lag по каждой partition снижаются;
- processing p95 и retry/timeout rates уменьшаются;
- consumer group stable, без всплеска rebalance;
- downstream dependency latency и error rate возвращаются к baseline;
- после догоняния backlog сервис продолжает работать без повторного накопления lag.

Учитывай, что lag может снижаться не сразу. Сопоставляй скорость входа, скорость обработки и текущий backlog; одного кратковременного падения lag недостаточно.

## Incident report

- **Impact:** какие события/бизнес-процессы задерживаются, сколько partitions/consumers затронуто?
- **Timeline:** alert, начало lag, dependency degradation, изменения и mitigation.
- **Evidence:** consumer group lag, producer/consumer rate, logs, dependency metrics, rebalance data.
- **Hypotheses:** что проверено и что исключено?
- **Root cause:** подтвержденный bottleneck.
- **Mitigation:** согласованное действие, риски и причина выбора.
- **Validation:** lag/rates/errors/latency и период стабильности.
- **Prevention:** alerts на lag, consumer processing rate, retry rate, dependency health; тесты устойчивости и capacity planning.

## Cleanup

Лаборатория не требует создания Kubernetes или Kafka ресурсов. Ничего удалять не нужно.

---

## Краткая шпаргалка

- **Lag** — разница между end offset и committed/current offset; трактовка зависит от tooling и client state.
- Lag может расти, даже если consumers подключены и Kafka brokers healthy.
- Смотри lag **по каждой partition**, а не только group total.
- Сопоставляй producer rate, processing rate, commit rate, processing latency, retries и dependency latency.
- Scaling не всегда remedy: partition count ограничивает параллелизм внутри одной group, а downstream capacity — допустимую нагрузку.
- Offset reset — потенциально destructive operation: не выполняй его без impact analysis, approval и плана восстановления.
