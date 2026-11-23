# Node Capacity, Allocatable и системные резервы

## Capacity vs Allocatable

У Node есть два разных значения ресурсов:

- **Capacity** — общий ресурс, который Kubernetes видит у узла (например, число CPU, объём памяти и ephemeral storage).
- **Allocatable** — ресурсы, которые Kubernetes считает доступными для размещения обычных Pod после вычета резервов и системных ограничений.

Allocatable не означает «сколько свободно прямо сейчас». Scheduler сравнивает requests новых Pod с Allocatable и уже размещёнными requests. Фактическое потребление может отличаться от requests, поэтому Node способен испытывать pressure, даже когда планирование формально укладывается в allocatable.

## Откуда берётся разница

На узле часть ресурсов нужна ОС, kubelet, container runtime и другим системным компонентам. В конфигурации kubelet могут быть заданы резервы:

- `systemReserved` — ресурсы для системных процессов ОС;
- `kubeReserved` — ресурсы для Kubernetes-компонентов, например kubelet и runtime;
- eviction reservations/thresholds — запас, который kubelet старается сохранить, чтобы узел не дошёл до критического состояния.

Настройка и точный состав резервов зависят от способа установки и конфигурации кластера. Не предполагай, что на каждом Node они явно заданы одинаково.

Упрощённо:

`Allocatable ≈ Capacity − systemReserved − kubeReserved − eviction reserve`

Формула иллюстративная: детали расчёта зависят от ресурса, конфигурации kubelet и версии Kubernetes.

## Почему Pod не может занять весь Capacity

Scheduler использует allocatable как верхнюю границу размещения requests. Если сумма requests уже близка к allocatable, новый Pod может остаться Pending, хотя `kubectl top node` показывает низкую загрузку.

Обратная ситуация тоже возможна: requests небольшие, Scheduler успешно размещает Pod, но их реальное потребление растёт и вызывает CPU contention, MemoryPressure или DiskPressure.

Важно различать:

- **Allocated requests** — зарезервированная scheduler-ом доля ресурсов по requests;
- **Actual usage** — текущее потребление, измеренное метриками;
- **Allocatable** — лимит ресурсов для планирования workload на Node.

## Диагностика

### 1. Посмотри Capacity и Allocatable

```bash
kubectl describe node <node>
```

В секциях `Capacity` и `Allocatable` сравни CPU, memory и ephemeral storage.

Более компактный вывод:

```bash
kubectl get node <node> -o jsonpath='{.status.capacity}{"\n"}{.status.allocatable}{"\n"}'
```

### 2. Проверь, сколько requests уже назначено

```bash
kubectl describe node <node>
```

В конце вывода найди `Allocated resources`. Это приблизительная scheduler-учётная картина requests/limits размещённых Pod, а не измерение фактической нагрузки.

### 3. Сопоставь requests с реальным потреблением

```bash
kubectl top node
kubectl top pods -A --sort-by=cpu
kubectl top pods -A --sort-by=memory
```

`kubectl top` показывает текущие значения. Для расследования инцидента нужны исторические графики: пиковое потребление, длительность нагрузки, момент появления симптомов и события Node.

### 4. Найди Pod на узле и проверь pressure

```bash
kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
kubectl describe node <node>
kubectl get events -A --sort-by=.metadata.creationTimestamp
```

В `describe node` изучи Conditions (`Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure`), события и распределение workload. Учитывай, что не все проблемы ресурсов отображаются как Node condition.

## Метрики Prometheus

Если установлен kube-state-metrics, полезны метрики:

- `kube_node_status_capacity` — Capacity по ресурсам;
- `kube_node_status_allocatable` — Allocatable по ресурсам;
- `kube_pod_container_resource_requests` — requests контейнеров;
- `kube_pod_container_resource_limits` — limits контейнеров.

Пример сравнения Allocatable CPU с суммой CPU requests на Node (имена метрик и labels могут отличаться в зависимости от версии kube-state-metrics и конфигурации):

```promql
sum by (node) (kube_pod_container_resource_requests{resource="cpu"})
/
kube_node_status_allocatable{resource="cpu"}
```

Для памяти аналогично:

```promql
sum by (node) (kube_pod_container_resource_requests{resource="memory"})
/
kube_node_status_allocatable{resource="memory"}
```

Эти запросы показывают долю allocatable, зарезервированную requests. Это не CPU/RAM utilization. Для actual usage используй метрики потребления контейнеров и node exporter, а также исторические графики.

## Типичный сценарий Production Support

**Симптом:** Deployment не масштабируется — новые Pod остаются Pending с сообщением о нехватке CPU или memory, при этом на Node по `kubectl top` загрузка кажется низкой.

Порядок расследования:

1. `kubectl describe pod <pod> -n <namespace>` — прочитай Events и точную причину Pending.
2. `kubectl describe node <node>` — сравни Capacity, Allocatable и Allocated resources.
3. Проверь requests новых Pod и уже размещённых workload.
4. Убедись, что подходящие Nodes не ограничены taints, affinity, selectors или другими требованиями Scheduling.
5. Сравни requests с историческим actual usage, чтобы выявить завышенные requests либо недостаточные резервы.
6. Не уменьшай requests только ради того, чтобы Pod прошёл scheduling: сначала оцени реальные пики и риск node pressure.

## Практические выводы

- Capacity — не то же самое, что Allocatable.
- Allocatable — не свободный остаток ресурсов, а планировочная граница.
- Scheduler учитывает requests, а не текущую загрузку Node.
- Низкий actual usage не гарантирует, что Pod можно разместить: requests могли уже исчерпать allocatable.
- Низкая доля requests не гарантирует отсутствия pressure: фактическое потребление может быть выше requests.
- Уменьшение requests может решить Pending, но ухудшить стабильность узла.

## Вопросы для самопроверки

1. Почему Pod может быть Pending из-за CPU, хотя `kubectl top node` показывает низкую загрузку?
2. Чем Allocatable отличается от «свободной памяти»?
3. Что Scheduler учитывает при размещении Pod: requests, limits или actual usage?
4. Почему недостаточные requests могут привести к node pressure?
5. Что проверишь, если Node Capacity выглядит достаточной, но Pod всё равно не размещается?

## Связанные материалы

- [Resources, QoS, OOMKilled и eviction](README.md)
- [CPU throttling и contention](cpu-throttling.md)
- [Memory accounting](memory-accounting.md)
- [Scheduling: taints, tolerations и affinity](../03-scheduling/scheduling-taints-affinity.md)
- [Node-pressure eviction (официальная документация)](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/)
- [Node (официальная документация)](https://kubernetes.io/docs/concepts/architecture/nodes/)
- [Resource management for Pods and containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
