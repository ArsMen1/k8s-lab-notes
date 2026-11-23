# Memory accounting: RSS, working set и cache

## Почему показания памяти могут отличаться

Когда расследуешь рост memory у Pod, не все инструменты показывают одно и то же. В Linux память можно измерять как RSS, working set, cache, объём memory cgroup и другие показатели. Они отвечают на разные вопросы и не обязаны совпадать.

**Не сравнивай числа разных метрик напрямую, пока не выяснил, что именно измеряется.** Например, значение `kubectl top` не является полным эквивалентом RSS процесса и не показывает гарантированно всю память, которую приложение может считать «занятой».

## Основные понятия

### RSS (Resident Set Size)

RSS — объём страниц процесса, находящихся в физической памяти в данный момент. Обычно включает anonymous memory и resident file-backed memory. Это полезный показатель для процессов, но не сумма RSS всех процессов внутри контейнера без оговорок: shared pages могут учитываться в RSS каждого процесса и приводить к двойному счёту.

RSS не показывает всю картину cgroup: ограничения и accounting контейнера включают дополнительные категории, а некоторые shared-memory и kernel memory детали зависят от реализации и версии.

### Working set

Working set — оценка памяти, которая активно используется и не считается легко reclaimable в конкретном методе расчёта. В Kubernetes/metrics pipeline значение memory usage часто рассчитывается с вычитанием части inactive file cache из cgroup usage. Конкретное поле и формула зависят от runtime, cAdvisor и версии.

Поэтому working set:
- не равен RSS;
- не равен memory limit;
- не обязательно отражает память, которую приложение само считает используемой;
- не является «точным объёмом памяти, который невозможно освободить».

### Page cache / file cache

Linux использует свободную RAM для кэширования файловых данных, ускоряя повторные чтения. Значительная часть file cache может быть освобождена при memory pressure, но не весь cache одинаково reclaimable и не вся cached memory без последствий может быть немедленно освобождена.

Cache — не автоматически утечка памяти. Если cache растёт, а приложение стабильно, это может быть нормальным поведением ОС.

### Anonymous memory

Anonymous memory — память без backing-файла, например heap приложения, стеки, некоторые runtime allocations. Она может включать heap, который приложение выделило, но пока не вернуло ОС. Рост anonymous memory часто заслуживает внимания, особенно если он устойчив и совпадает с ростом нагрузки или длительностью работы.

### Memory cgroup usage

Memory cgroup accounting учитывает память на уровне ограничиваемой группы процессов. Значения cgroup могут включать anonymous memory, file cache и другие категории, в зависимости от версии kernel и конфигурации. Это accounting, используемый для контроля лимита, но не обязательно совпадает с метрикой, которую отображает `kubectl top`.

В cgroup v2 полезны файлы:
- `memory.current` — текущее потребление cgroup;
- `memory.max` — установленный максимум (или `max`, если лимит не задан);
- `memory.stat` — детализация по категориям, включая anonymous и file;
- `memory.events` — счётчики событий, например `oom` и `oom_kill`, если доступны.

Для доступа к cgroup-файлам обычно требуется node/container-level доступ. Не предполагай, что они доступны из обычного Pod.

## Что показывают инструменты

| Инструмент / метрика | Что показывает | Ограничения |
|---|---|---|
| `kubectl top pod --containers` | Текущую память контейнеров из metrics pipeline | Не история, не peak; значение зависит от pipeline и метрики |
| `kubectl describe pod` | Requests/limits, status, events, termination reason | Не показывает полный временной профиль памяти |
| `kubectl describe node` | Allocatable, Conditions, события и pressure | Не детальная memory accounting каждого процесса |
| `ps` / `top` внутри Node | Процессы и их memory metrics | Namespace/cgroup особенности, shared pages, инструменты могут отсутствовать |
| cgroup `memory.current` / `memory.stat` | Memory accounting cgroup | Нужен доступ к node/container и понимание версии cgroup |
| Prometheus | История и динамика метрик, если они собираются | Метрики/labels/формулы зависят от источника и конфигурации |

## Диагностика через Kubernetes

Сначала установи scope: один контейнер, весь Pod, несколько Pod или Node.

```bash
kubectl top pod -n <namespace> --containers
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl describe node <node>
kubectl get events -A --sort-by=.metadata.creationTimestamp
```

Посмотри:
- текущую память каждого контейнера, включая sidecar;
- memory requests/limits;
- restart count и termination reason;
- `OOMKilled`, `Evicted`, `MemoryPressure`;
- рост числа рестартов или повторяющийся pattern;
- одновременно деградирующие Pod на той же Node.

`kubectl top` — снимок текущего состояния. Для memory leak или peak usage необходимы исторические графики.

## Диагностика изнутри контейнера

Если в image есть нужные инструменты и доступ разрешён:

```bash
ps aux
cat /proc/<pid>/status
```

В `/proc/<pid>/status` полезны `VmRSS`, `VmSize` и другие поля. Не интерпретируй `VmSize` как физически занятые RAM: это виртуальное адресное пространство. RSS тоже не равен cgroup usage и может включать shared pages.

Для cgroup v2 на node (путь зависит от runtime и расположения cgroup):

```bash
cat memory.current
cat memory.max
cat memory.stat
cat memory.events
```

Не выполняй эти команды на произвольном хосте в production без разрешённого доступа. Для расследования используй доступные read-only инструменты и утверждённые процедуры.

## Как отличить нормальный рост от утечки

### Возможный нормальный рост

- memory растёт после старта и затем выходит на плато;
- cache растёт при чтении файлов, но при pressure может reclaim;
- рост связан с увеличением traffic или числа обработанных задач;
- после нагрузки память стабилизируется или снижается;
- рестартов и признаков деградации нет.

### Возможная memory leak / неограниченное накопление

- memory steadily растёт в течение длительного периода без плато;
- рост повторяется при одинаковом профиле нагрузки;
- после снижения трафика память не возвращается к ожидаемому уровню;
- рост совпадает с увеличением heap/object/cache/pool в runtime;
- контейнер регулярно достигает limit и завершается OOMKilled.

Это признаки для проверки, а не окончательный диагноз. У некоторых приложений heap после роста не уменьшается сразу, даже если объекты стали недоступны: runtime может удерживать выделенную память для последующего использования.

## Prometheus: полезные метрики

Названия зависят от экспортеров и relabeling. Для cAdvisor/Kubernetes monitoring часто встречаются:

- `container_memory_working_set_bytes` — working set контейнера;
- `container_memory_usage_bytes` — memory usage cgroup;
- `container_memory_rss` — RSS, если экспортируется;
- `container_memory_cache` — cache, если экспортируется;
- `kube_pod_container_resource_limits` — ресурсные лимиты из kube-state-metrics (labels/schema зависят от версии);
- `kube_pod_container_resource_requests` — requests, если доступна метрика.

Тренд working set относительно memory limit:

```promql
container_memory_working_set_bytes
/
container_spec_memory_limit_bytes
```

Для конкретного окружения фильтруй namespace, pod и container. Проверь, что лимит существует и метрики не дублируются для одного контейнера. Некоторые источники метрик используют другие имена или labels.

Рост working set во времени (пример):

```promql
container_memory_working_set_bytes{namespace="<namespace>", pod="<pod>", container="<container>"}
```

Смотри trend в графике, а не одну точку. Сопоставляй memory с traffic, restarts, deployment changes, heap/GC metrics и memory limit.

## OOM: что искать

При OOM investigation не ограничивайся графиком memory:

1. Уточни, какой контейнер завершился, и его `lastState`/`reason`.
2. Проверь Pod events и restart count.
3. Сопоставь memory metrics с limit и временной точкой OOM.
4. Если доступно, изучи cgroup `memory.events`, node/kernel/runtime logs.
5. Уточни, был ли это container limit OOM или node-wide memory pressure/eviction.
6. Проверь runtime/app metrics: heap, GC, caches, connection pools, native memory.
7. Сравни с нагрузкой и предыдущими deployment/config changes.

```bash
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o jsonpath='{range .status.containerStatuses[*]}{.name}{" lastReason="}{.lastState.terminated.reason}{" exitCode="}{.lastState.terminated.exitCode}{" restartCount="}{.restartCount}{"\n"}{end}'
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
```

Container-level OOM и Node memory pressure — разные сценарии. Не делай вывод только по exit code или одному графику.

## Пример расследования

**Симптом:** контейнер приложения периодически перезапускается, а `kubectl top` после рестарта показывает низкую память.

**Ход проверки:**
- `describe pod` показывает previous termination reason `OOMKilled`;
- исторический график показывает рост working set к memory limit перед рестартом;
- после restart usage снова низкий, что скрывает peak в текущем snapshot;
- requests/limits проверены, также проверены sidecars;
- node не демонстрирует общую MemoryPressure в момент инцидента.

**Рабочая гипотеза:** контейнер достигает своего memory limit из-за роста memory usage. Далее нужно выяснить, что именно удерживает память: heap, cache, objects, native allocations, buffers или другая причина. Сам график working set не доказывает leak.

## Практические правила

- Не называй любой рост RAM memory leak.
- Не считай cache автоматически проблемой.
- Не используй RSS, working set и cgroup usage как взаимозаменяемые показатели.
- Не полагайся на `kubectl top` как источник исторического peak.
- Не увеличивай memory limit без проверки node capacity и причины роста.
- При анализе Java/.NET/Node/Python приложений по возможности используй runtime-specific heap/GC metrics — container memory включает не только managed heap.
- Ищи корреляцию: memory trend + traffic + restarts + OOM events + deployment changes.

## Вопросы для самопроверки

- Почему RSS и `kubectl top` могут показывать разные значения?
- Чем working set отличается от memory cgroup usage?
- Почему рост file cache не обязательно означает утечку?
- Почему `VmSize` не равен физически занятой RAM?
- Почему memory после GC может не уменьшиться на графике контейнера?
- Как OOMKilled может быть пропущен, если смотреть только текущий `kubectl top`?
- Как отличить container OOM от Node memory pressure?
- Какие дополнительные метрики нужны, чтобы проверить гипотезу memory leak?

## Связанные материалы

- [Resources, QoS, OOMKilled и eviction](README.md)
- [CPU throttling и CPU contention](cpu-throttling.md)
- [HPA](../15-hpa/README.md)
- [Observability](../16-observability/README.md)
- [Manifests: Resources](../../Manifests/resources/README.md)
- [P0 fundamentals](../../labs/fundamentals-p0/README.md)
