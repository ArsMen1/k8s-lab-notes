# JVM Heap, Garbage Collection и Stop-the-World pauses

## Зачем это знать Production Support Engineer

Java-приложение может отвечать медленно, периодически терять throughput или выдавать скачки latency, хотя CPU и memory usage Pod выглядят относительно нормально. Одна из возможных причин — работа Garbage Collector (GC): сборка мусора может потреблять CPU, менять доступную память и в некоторых режимах приостанавливать application threads.

GC — не автоматически root cause. Сначала сопоставляй симптомы приложения, JVM metrics, GC events и время инцидента.

## 1. Heap и память JVM — не одно и то же

Heap — область памяти JVM для объектов, управляемая garbage collector. Но общий memory usage Java-контейнера включает больше, чем heap:

- Java heap (объекты);
- Metaspace (метаданные классов);
- thread stacks;
- direct buffers / native buffers;
- JIT/compiler и другие native allocations;
- память native libraries и runtime.

Поэтому увеличение container memory не всегда означает, что нужно увеличивать `-Xmx`. Heap может быть стабилен, а native memory или количество threads расти.

## 2. Heap: базовая структура

В generational collectors heap обычно организован с учётом возраста объектов. Конкретная структура зависит от GC и версии JVM.

- **Young generation** — место, где часто создаются новые объекты.
- **Old generation** — объекты, пережившие несколько циклов и/или перемещённые в область долгоживущих объектов.
- **Allocation rate** — скорость создания новых объектов; высокий allocation rate может увеличить частоту GC.
- **Live set** — объекты, которые остаются достижимыми после сборки; это важнее одного только размера heap.

Схематично: новые объекты появляются, часть быстро становится unreachable и удаляется, а объекты, сохраняющиеся дольше, могут попадать в более долгоживущие области.

## 3. Что делает Garbage Collector

GC освобождает память объектов, которые больше не достижимы из GC roots (например, активных references, thread stacks, static references и других корней).

Типичный цикл концептуально:

1. Приложение создаёт объекты.
2. Heap постепенно заполняется.
3. GC определяет достижимые объекты.
4. Недостижимые объекты reclaim-ятся; конкретный collector может также перемещать/компактировать объекты.
5. JVM продолжает работу или выполняет дополнительные GC cycles.

Не все GC работают одинаково. Некоторые используют concurrent phases, некоторые могут иметь stop-the-world phases, а алгоритмы, компромиссы throughput/latency и поведение отличаются.

## 4. Stop-the-World (STW)

Stop-the-World — фаза, во время которой JVM приостанавливает application threads, чтобы выполнить определённые операции GC или runtime.

**Почему это важно:** пока application threads остановлены, они не обрабатывают новые запросы и не продвигают текущую работу. Если пауза длится 500 ms, часть запросов может ждать, timeout-иться или резко ухудшать latency.

STW не обязательно означает, что весь GC проходит в остановке. Многие современные collectors выполняют значительную работу concurrent с приложением, но всё равно имеют отдельные pause phases.

Признаки возможного влияния pauses:

- скачки p95/p99 latency;
- короткие интервалы, в которых throughput падает;
- таймауты на фоне пауз;
- временная очередь запросов, после которой нагрузка «догоняет»;
- GC pause duration spikes, совпадающие с деградацией.

## 5. Как GC может ухудшить производительность

### Частые короткие GC

Частые young collections могут быть нормальными, но если их частота/суммарное время растёт вместе с latency, исследуй allocation rate, объём временных объектов и нагрузку.

### Длинные pauses

Длинные GC pauses могут быть причиной tail latency и timeout-ов. Не смотри только на среднее время: важны распределение и максимумы за incident window.

### Высокий allocation rate

Много краткоживущих объектов увеличивают нагрузку на GC. Например, рост трафика или изменение кода может резко увеличить allocations per request.

### Высокий live set / pressure

Если много объектов остаются достижимыми, GC может освобождать мало памяти. Heap после GC остаётся высоким; циклы могут становиться тяжелее. Возможны memory leak, cache growth, большие batches или долгоживущие references.

### GC overhead и throughput

GC может занимать заметную долю времени и CPU. Увеличение heap иногда снижает частоту collections, но может увеличить длительность некоторых phases и не решает проблему live set или allocation behavior.

## 6. Какие метрики смотреть

Названия метрик зависят от exporter, runtime, GC и версии.

### JVM / GC metrics

- Heap used / committed / max.
- Old generation occupancy (если доступна).
- Allocation rate.
- GC count и GC time по collector/поколениям.
- Pause duration distribution (особенно p95/p99/max).
- GC cause.
- Live data / post-GC occupancy.
- Thread count.
- Метрики pool-ов и приложения: request latency, throughput, errors, queue depth.

### Prometheus — примеры

Имена ниже встречаются в разных exporter-ах и не являются универсальной схемой; сначала посмотри, какие series реально экспортируются.

```promql
# Heap usage
jvm_memory_used_bytes{area="heap"}

# Heap maximum (если exporter публикует)
jvm_memory_max_bytes{area="heap"}

# Количество GC events, rate по collector
rate(jvm_gc_pause_seconds_count[5m])

# Суммарное время GC pauses за окно
rate(jvm_gc_pause_seconds_sum[5m])

# Thread count
jvm_threads_live_threads
```

Для GC pause duration используй histogram, если доступна, чтобы анализировать распределение (p95/p99), а не только среднее:

```promql
histogram_quantile(
  0.99,
  sum by (le) (rate(<gc_pause_duration_bucket>[5m]))
)
```

Placeholder `<gc_pause_duration_bucket>` замени на реальное имя histogram metric; не копируй запрос вслепую.

## 7. GC logs — источник подробностей

При наличии доступа к JVM GC logs они могут показывать:

- время и длительность GC;
- причину запуска;
- тип collection;
- heap occupancy до/после;
- pause phases;
- concurrent phases и их duration;
- allocation failure / promotion pressure;
- предупреждения об эвакуации/компактации или неудачных циклах (зависит от collector).

GC logging flags различаются между версиями Java. Не меняй JVM flags в production без согласованного изменения, оценки риска и rollout plan. Сначала используй уже включённые логи и метрики.

## 8. Как связать GC с Kubernetes

Сопоставляй JVM heap с memory cgroup/container:

- Heap может быть ниже container memory limit, но native memory, stacks и direct buffers доводят контейнер до OOM.
- Container memory limit не равен `-Xmx`; оставляй место для non-heap/native allocations.
- `kubectl top` показывает текущий snapshot и может пропустить кратковременные пики.
- OOMKilled и GC pause — разные события. Pod может испытывать длинные pauses без OOM, или быть OOMKilled без аномальных GC pauses.
- CPU throttling может замедлить GC и concurrent phases; проверяй throttling вместе с GC и latency.
- Несколько реплик могут иметь разные GC patterns из-за неодинакового трафика, состояния cache или workload.

Команды Kubernetes для первичного контекста:

```bash
kubectl describe pod <pod> -n <namespace>
kubectl top pod <pod> -n <namespace> --containers
kubectl get pod <pod> -n <namespace> -o yaml
kubectl describe node <node>
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
```

Это не заменяет JVM observability: Kubernetes не знает heap layout и не объясняет причины GC.

## 9. Production Support: алгоритм расследования

1. **Зафиксируй симптом:** какой endpoint/operation, latency (p95/p99), throughput, error rate и время начала.
2. **Определи scope:** один Pod, все replicas, одна Node или все instances?
3. **Сопоставь графики:** application latency, throughput, GC pauses, heap used/committed, allocation rate, CPU, throttling, container memory.
4. **Проверь GC logs:** были ли pauses или collections в момент деградации? Какой collector и какой тип event?
5. **Сравни до/после GC:** heap occupancy возвращается к прежнему уровню или steadily растёт? Отличай temporary allocation churn от увеличения live set.
6. **Проверь сопутствующие сигналы:** thread count, pool utilization, request queue, downstream latency, traffic spikes.
7. **Сравни healthy и affected instances:** неравномерное распределение нагрузки или cache state может объяснить различия.
8. **Сформулируй гипотезу и подтверждение:** не предлагай heap tuning только потому, что heap usage высокий.

## 10. Пример инцидента

**Симптом:** p99 API latency периодически увеличивается до нескольких секунд. CPU в среднем 45%, memory контейнера не достигает limit, restart count не растёт.

Проверка обнаруживает, что пики latency совпадают с GC pause spikes. Heap после collections возвращается к умеренному уровню, но allocation rate вырос после изменения трафика/версии приложения.

Рабочая гипотеза: высокий allocation rate вызывает более частые collections, а pause phases влияют на tail latency.

Что требуется подтвердить:

- GC events совпадают с latency spikes по времени;
- allocation rate отличается от baseline;
- pauses достаточной длительности, чтобы объяснить симптом;
- другие зависимости не дают аналогичной корреляции.

Действия не должны начинаться с бездумного увеличения `-Xmx`. Следующий шаг — анализ allocations, workload, GC configuration и профиля объектов, совместно с командой приложения.

## 11. Heap tuning: почему «просто увеличить Xmx» — плохой первый шаг

Увеличение heap может снизить частоту GC, если проблема связана с частыми collections и есть достаточный запас RAM. Но оно может:

- увеличить container memory pressure;
- привести к OOM на уровне контейнера из-за non-heap/native memory;
- изменить характер и длительность GC phases;
- скрыть утечку или unbounded cache;
- ухудшить ситуацию, если причина в pauses, allocation behavior или зависимостях.

Любое tuning требует baseline, метрик, тестирования под репрезентативной нагрузкой и контроля после rollout.

## 12. Краткие правила

- GC — не всегда проблема; collections являются нормальной частью работы JVM.
- STW pause может влиять на latency, даже когда средние CPU/RAM выглядят нормально.
- Смотри не только GC count, но и pause duration, allocation rate, post-GC heap и application latency.
- Heap — только часть memory usage JVM/container.
- GC pauses, CPU throttling и OOMKilled — разные механизмы, которые могут взаимодействовать.
- Не меняй `-Xmx`, GC collector или flags без evidence и согласованного плана.
- Метрики и названия series зависят от exporter; сначала проверяй доступный набор.

## Вопросы для самопроверки

1. Что такое heap и чем он отличается от общей памяти контейнера?
2. Что такое allocation rate и почему его рост может участить GC?
3. Что означает Stop-the-World?
4. Почему GC pause spikes могут увеличить p99 latency?
5. Чем частые короткие collections отличаются от длинных pauses?
6. Как отличить высокий heap usage от возможного memory leak?
7. Почему увеличение `-Xmx` может привести к OOMKilled?
8. Какие данные ты сопоставишь, прежде чем объявить GC причиной инцидента?

## Связанные материалы

- [Resources, QoS, OOMKilled и eviction](README.md)
- [CPU throttling и contention](cpu-throttling.md)
- [Memory accounting](memory-accounting.md)
- [Node Capacity, Allocatable и системные резервы](node-capacity-allocatable.md)
- [Disk I/O, IOPS, latency и DiskPressure](disk-io-performance.md)
- [Performance troubleshooting при нормальных ресурсах](performance-troubleshooting-normal-resources.md)
- [Java Garbage Collection (официальная документация Java)](https://docs.oracle.com/en/java/javase/