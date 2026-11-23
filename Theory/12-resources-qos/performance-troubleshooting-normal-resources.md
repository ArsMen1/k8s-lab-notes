# Performance troubleshooting: CPU, Memory и Disk в норме, но приложение медленное

## Главный принцип

Если приложение медленное, не спеши увеличивать CPU или RAM. Высокая latency может быть вызвана ожиданием ресурса, очередью, блокировкой, внешней зависимостью или ограничением concurrency.

Потребление ресурсов Pod — лишь часть картины. Приложение может иметь низкий CPU потому, что большинство потоков ждут; memory может быть стабильной, потому что очередь ограничена; Disk metrics могут выглядеть нормально, поскольку задержка происходит в базе данных, сети или распределённом lock.

## 1. Начинай с симптома и масштаба

Определи:

- какие endpoints или операции стали медленными;
- выросли ли p50, p95, p99 latency;
- увеличилось ли число ошибок, timeouts или retries;
- затронут один Pod, один node, один сервис или все пользователи;
- когда началась проблема и с чем совпало начало.

Сравни здоровый и проблемный экземпляр, если они есть. Одинаковая проблема у всех replicas чаще указывает на общую зависимость или изменение приложения/трафика, но это не доказательство.

## 2. Connection pool exhaustion

Приложение может не иметь свободных соединений к базе данных, HTTP-сервису, брокеру или другому dependency.

Типичные признаки:

- запросы ожидают соединение из пула;
- растёт latency, хотя CPU умеренный;
- появляются сообщения вроде `connection timeout`, `pool exhausted`, `pending acquisition`;
- количество открытых соединений достигло configured maximum;
- увеличение времени работы downstream повышает время удержания connections, и очередь на pool растёт.

Что запросить у команды приложения или проверить в dashboards/logs:

- текущие active/idle connections;
- максимальный размер pool;
- waiting/pending acquisition;
- acquisition timeout;
- время удержания connection;
- ошибки подключения и database-side limits;
- запросы с длительным временем выполнения.

Не увеличивай pool без проверки. Большие pools могут усилить нагрузку на БД, вызвать connection storm и ухудшить ситуацию.

## 3. Thread pool / worker exhaustion

У приложения может закончиться возможность обрабатывать новую работу, даже если CPU не занят.

Признаки:

- requests зависают в очереди;
- thread pool достиг максимального количества workers;
- очередь задач растёт;
- активные workers долго не освобождаются;
- ошибки rejection, timeouts, stuck threads;
- latency ухудшается при увеличении concurrency.

Проверяй:

- active threads vs configured maximum;
- queue depth;
- rejected tasks;
- длительность задач;
- blocked/waiting threads;
- deadlocks или contention;
- thread dump / профилировщик (если это разрешено и доступно).

Потоки в состоянии waiting/blocked не обязательно означают проблему: это нормальное поведение, если они ждут события. Важно увидеть, на чём именно они ждут, и как долго.

## 4. Очереди и backpressure

Очереди позволяют временно переживать всплески нагрузки, но если скорость поступления работы постоянно выше скорости обработки, backlog будет расти.

Проверь:

- incoming rate vs processing rate;
- queue length / backlog;
- возраст самой старой задачи;
- retry rate;
- dead-letter queue;
- consumer lag;
- время обработки одной задачи;
- ограничения concurrency у consumers.

Для Kafka, например, consumer lag полезен как индикатор отставания, но его нужно сопоставлять с throughput, количеством partition, скоростью producers/consumers и длительностью обработки. Увеличение числа consumers не всегда помогает, если есть ограничения по partition, downstream или shared resources.

Если система поддерживает backpressure, выясни, применяется ли оно: замедляет ли producer поток данных, ограничивает ли очередь, или работа бесконтрольно накапливается.

## 5. Lock contention и синхронизация

Проблема может быть вызвана ожиданием блокировок:

- database locks;
- mutex/semaphore;
- synchronized sections;
- distributed locks;
- contention за shared state;
- очереди на одну критическую секцию.

Симптомы:

- latency растёт с concurrency;
- CPU может быть невысоким;
- отдельные операции выполняются медленно, остальные ждут;
- database waits/locks увеличиваются;
- timeout происходит в ожидании lock.

Проверяй lock/wait metrics, database lock reports, tracing и профили потоков. Не пытайся просто увеличить replicas, если bottleneck — общая блокировка или shared database.

## 6. Downstream dependency и network wait

Медленный сервис может быть не тем, который отображает ошибку пользователю. Например:

`frontend → API → database → external API`

Если external API отвечает 2 секунды, внутренний API может выглядеть медленным, хотя CPU/RAM в норме.

Исследуй:

- dependency latency и error rate;
- connect timeout vs read timeout;
- DNS resolution latency;
- retries и exponential backoff;
- число одновременных вызовов;
- circuit breaker state;
- TCP connection reuse;
- traces с разбивкой времени по spans.

Retries способны усиливать инцидент: при деградации зависимого сервиса количество запросов может резко увеличиться. Уточни, не создаёт ли retry storm дополнительную нагрузку.

## 7. JVM / Garbage Collection — отдельный случай

Для Java-приложений CPU и memory usage могут выглядеть приемлемо, но задержки возникать из-за GC или allocation pressure.

Проверяй:

- heap usage до/после GC;
- частоту и длительность GC pauses;
- allocation rate;
- количество объектов и поведение старых поколений (для соответствующего GC);
- thread states;
- GC logs и JVM metrics.

Не делай вывод о GC только по тому, что heap близок к limit. Сопоставляй pauses и latency конкретных запросов по времени.

Подробнее: [JVM Heap, GC и Stop-the-World pauses](jvm-heap-gc-stw.md) и [Thread dumps, deadlocks и диагностика зависших Java-приложений](thread-dumps-deadlocks.md).

## 8. Kubernetes: что может помочь, а что не покажет

Сначала собери базовое состояние:

```bash
kubectl get pods -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl top pods -n <namespace> --containers
kubectl top node
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
```

Проверь:

- restarts и OOMKilled;
- requests/limits;
- throttling;
- readiness/liveness failures;
- распределение replicas по Node;
- HPA events и текущие/desired replicas;
- node pressure;
- rollout и изменения конфигурации;
- network policies и сервисные зависимости — если есть соответствующие симптомы.

Kubernetes показывает состояние контейнеров, ресурсов и инфраструктуры, но не заменяет application metrics, thread dump, connection pool telemetry или distributed tracing.

## 9. Как использовать metrics, logs и traces вместе

**Metrics** — когда, насколько часто и насколько сильно проблема проявляется: latency, throughput, saturation, pool usage, queue length.

**Logs** — конкретные ошибки, timeouts, retries, отказ в получении connection, stack trace.

**Traces** — где именно запрос провёл время: API, DB, HTTP dependency, очереди, retries.

Идеальный старт расследования — взять медленный trace и найти span, который занимает большую часть времени. Если traces нет, используй метрики latency dependencies и структурированные logs, затем сузь область поиска.

## 10. Практический алгоритм Production Support

1. Зафиксируй симптом: latency, error rate, affected endpoints и время начала.
2. Проверь scope: все replicas или конкретные Pod/Node/zone?
3. Сопоставь с deployments, traffic changes, config changes и background jobs.
4. Проверь CPU throttling, memory pressure/OOM, disk pressure/I/O.
5. Если ресурсы нормальны, исследуй pools, queues, locks и dependency latency.
6. Сопоставь application metrics, logs и traces.
7. Формулируй гипотезу, указывай факты, которые её подтверждают или опровергают.
8. Предложи безопасное действие и способ проверить результат.
9. После восстановления убедись, что latency и backlog вернулись к норме; зафиксируй root cause и preventive action.

## Пример инцидента

**Симптом:** p95 latency API выросла с 250 ms до 4 s. CPU 25–40%, memory стабильна, Pod не перезапускались, DiskPressure отсутствует.

Наблюдения:

- latency DB запросов почти не изменилась;
- HTTP dependency latency выросла;
- количество retries увеличилось в 5 раз;
- connection pool достиг максимума, pending acquisition растёт.

Возможная цепочка:

1. downstream API начал отвечать медленно;
2. внутренние запросы стали дольше удерживать connections;
3. connection pool заполнился;
4. новые requests стали ждать свободного connection;
5. retries дополнительно увеличили нагрузку;
6. latency внутреннего API выросла, хотя CPU и RAM оставались нормальными.

**Root cause** здесь не «нужно больше CPU» и не обязательно «увеличить pool». Начинать нужно с подтверждения downstream degradation и механизма retries. Возможные меры — корректировка retry policy, timeouts, circuit breaker, concurrency limits или устранение проблемы downstream; конкретное решение зависит от архитектуры и согласуется с владельцами сервиса.

## Что не стоит делать первым

- Бездумно увеличивать CPU/RAM.
- Увеличивать replicas, не проверив общий bottleneck.
- Увеличивать connection pool, не оценив нагрузку на dependency.
- Увеличивать queue size, если processing rate не меняется.
- Отключать timeouts или retries без понимания их роли.
- Делать вывод по одному snapshot `kubectl top`.
- Перезапускать Pod, не сохранив evidence, если это не требуется для mitigation.

## Вопросы для самопроверки

1. Почему CPU может быть низким при высокой latency?
2. Как connection pool exhaustion влияет на requests?
3. Чем thread pool saturation отличается от CPU saturation?
4. Как понять, что backlog растёт из-за недостаточной processing capacity?
5. Почему увеличение replicas не всегда решает bottleneck?
6. Как retries могут усилить проблему downstream?
7. Какие данные помогут доказать, что причина в dependency, а не в Kubernetes?
8. Что ты приложишь к incident report, чтобы обосновать root cause?

## Связанные материалы

- [Resources, QoS, OOMKilled и eviction](README.md)
- [CPU throttling и contention](cpu-throttling.md)
- [Memory accounting](memory-accounting.md)
- [Node Capacity, Allocatable и системные резервы](node-capacity-allocatable.md)
- [Disk I/O, IOPS, latency и DiskPressure](disk-io-performance.md)
- [Observability](../16-observability/README.md)
- [HPA](../15-hpa/README.md)
- [Production Support практикум](../../labs/production-support/README.md)
