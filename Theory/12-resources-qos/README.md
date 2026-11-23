# Resources, QoS, OOMKilled и eviction

## Requests и limits

requests.cpu/memory — ресурсы, которые scheduler учитывает при размещении Pod. limits.cpu ограничивает CPU (обычно throttling); превышение CPU limit само по себе не завершает контейнер. limits.memory — memory cgroup limit; при превышении контейнер может быть завершён OOM killer-ом.

Scheduler планирует по requests, а не по текущему потреблению и не по limits как основному критерию. Низкие requests относительно реальной нагрузки увеличивают риск node pressure.

## Практические resource incident labs

- [CPU throttling: latency выросла, CPU выглядит невысоким](../../labs/troubleshooting/cpu-throttling.md)
- [Memory incident: OOMKilled или Node MemoryPressure](../../labs/troubleshooting/memory-oom.md)
- [Scaling incident: replicas выросли, а сервис стал хуже](../../labs/troubleshooting/scaling-worsens.md)

## CPU throttling и contention

Подробный разбор механизма CFS quota, отличий throttling от node-level contention, симптомов, метрик Prometheus и порядка диагностики: [CPU throttling и CPU contention](cpu-throttling.md).

## Memory accounting

Разница между RSS, working set, page cache и memory cgroup usage, диагностика роста памяти и OOM: [Memory accounting](memory-accounting.md).

## Node Capacity и Allocatable

Чем Capacity отличается от Allocatable, системные резервы, scheduler accounting по requests и диагностика Pending/Node pressure: [Node Capacity, Allocatable и системные резервы](node-capacity-allocatable.md).

## Disk I/O и DiskPressure

Диагностика медленного storage, IOPS, throughput, latency, inode, ephemeral storage, DiskPressure и конкуренции за I/O: [Disk I/O, IOPS, latency и DiskPressure](disk-io-performance.md).

## Performance troubleshooting при нормальных ресурсах

Разбор задержек, вызванных connection/thread pools, очередями, locks, retries и downstream dependencies, когда CPU, RAM и Disk не показывают явного bottleneck: [Performance troubleshooting: ресурсы в норме, приложение медленное](performance-troubleshooting-normal-resources.md).

## QoS classes

- Guaranteed: для каждого контейнера заданы CPU и memory requests и limits, причём requests равны limits для обоих ресурсов. Учитывай init containers и правила целевой версии.
- Burstable: есть хотя бы один request/limit, но условия Guaranteed не выполнены.
- BestEffort: нет CPU/memory requests и limits.

QoS влияет на eviction при node pressure, но не гарантирует, что Pod никогда не будет завершён.

## OOMKilled vs Evicted

OOMKilled обычно означает превышение memory cgroup limit либо выбор kernel OOM killer. Evicted — kubelet удалил Pod из-за node pressure (memory, disk, PID и др.). MemoryPressure/DiskPressure — Node conditions, а не состояния контейнера.

## Ephemeral storage

Локальное ephemeral storage включает writable layer, container logs и disk-backed emptyDir. Для него можно задавать requests/limits через ephemeral-storage. Переполнение может вызвать eviction. Memory-backed emptyDir учитывается как memory, а не как обычное local ephemeral storage; указывай sizeLimit и учитывай memory limit.

## Диагностика

    kubectl describe pod <pod> -n <namespace>
    kubectl get pod <pod> -n <namespace> -o jsonpath='{.status.qosClass}{"\n"}'
    kubectl describe node <node>
    kubectl top pod -n <namespace> --containers
    kubectl top node
    kubectl get events -A --sort-by=.metadata.creationTimestamp

kubectl top требует работающий metrics pipeline и показывает текущие метрики, не исторический peak. Для подтверждения причины нужны container status, events и при необходимости node/runtime/kernel logs.

Связанные материалы: [Scheduling](../03-scheduling/scheduling-taints-affinity.md), [Resource manifests](../../Manifests/resources/README.md), [P0 labs](../../labs/fundamentals-p0/README.md).

Официально: [Resource management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/), [Node-pressure eviction](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/).

## JVM Heap, Garbage Collection и Stop-the-World pauses

Подробный разбор heap, allocation rate, GC, STW pauses, GC metrics/logs и расследования latency-инцидентов в Java workloads: [JVM Heap, GC и Stop-the-World](jvm-heap-gc-stw.md).
