# Disk I/O, IOPS, latency и DiskPressure

## Почему приложение может тормозить при нормальных CPU и RAM

Производительность Node зависит не только от процессора и памяти. Если приложение активно читает или записывает данные, оно может упираться в storage: медленные операции, очередь запросов, высокий latency или ограниченные IOPS/throughput.

Симптомы могут быть похожи на CPU/RAM проблемы:

- API отвечает медленно, растёт latency запросов.
- Время выполнения фоновых задач увеличивается.
- Базы данных или приложения с файловыми операциями начинают тормозить.
- CPU utilization низкий или умеренный: процессы ждут завершения I/O.
- В контейнере нет OOMKilled, а Pod остаётся Running.

## Основные понятия

- **I/O (Input/Output)** — операции чтения/записи данных.
- **IOPS** — количество операций ввода-вывода в секунду. Важны размер и характер операций (random/sequential).
- **Throughput** — объём данных, передаваемый за время (например, MB/s).
- **Latency** — время выполнения отдельной операции I/O. Для приложения особенно важны хвостовые задержки (p95/p99).
- **Queue depth** — сколько операций ожидает выполнения или находится в работе. Большая очередь может сопровождать перегруженное устройство, но сама по себе не доказывает причину.
- **DiskPressure** — Kubernetes Node condition, связанная с нехваткой дисковых ресурсов/нарушением eviction thresholds; это не универсальный индикатор высокой latency.

## Что storage может означать в Kubernetes

В зависимости от типа данных и конфигурации Pod может использовать:

- writable layer контейнера;
- container logs;
- локальный `emptyDir`;
- локальные диски Node;
- PersistentVolume через CSI (network storage, cloud disk, SAN/NAS и другие backend-ы);
- временные файлы и cache.

Не каждый storage path ведёт к одному и тому же физическому устройству. PersistentVolume может быть сетевым или распределённым хранилищем; локальный I/O в Node и latency удалённого storage нужно диагностировать разными слоями.

## DiskPressure — это не то же самое, что storage latency

**DiskPressure** говорит о состоянии дисковых ресурсов Node и может привести к eviction. Она не означает автоматически, что приложение тормозит из-за медленного диска.

И наоборот, storage может испытывать высокую latency или throughput saturation, но свободного места достаточно, поэтому DiskPressure не будет.

Разделяй две линии расследования:

1. **Capacity / space:** свободное место, inode, ephemeral storage, image filesystem, logs, рост файлов.
2. **Performance:** latency, IOPS, throughput, очередь, backend storage health, конкуренция за диск.

## 1. Проверить Pod и Node

```bash
kubectl describe pod <pod> -n <namespace>
kubectl describe node <node>
kubectl get events -A --sort-by=.metadata.creationTimestamp
kubectl top node
kubectl top pods -A --containers
```

Ищи:

- `DiskPressure` condition;
- сообщения eviction;
- `ephemeral-storage` requests/limits и их отсутствие;
- рост container logs или временных файлов;
- события, связанные с volume mount или CSI;
- Pod, которые одновременно используют один storage backend.

`kubectl top` не даёт disk latency/IOPS. Не делай вывод о disk performance только по CPU/RAM utilization.

## 2. Проверить disk space и inode на Node

Если у тебя есть разрешённый доступ к Node (SSH, debug node или мониторинг), проверь:

```bash
df -h
df -i
```

- `df -h` — заполнение файловых систем.
- `df -i` — использование inode. Ситуация, когда inode исчерпаны, может мешать создавать файлы даже при свободных GB.

Для container runtime и kubelet важно понять, где находятся root directory, image storage, container logs и ephemeral volumes. Путь и разделение файловых систем зависят от конфигурации Node.

## 3. Linux-инструменты для I/O performance

При наличии доступа к Node:

```bash
iostat -xz 1
```

Показывает статистику устройств в интервале, в том числе latency и загрузку/очередь в зависимости от версии sysstat и доступных колонок.

```bash
iotop
```

Помогает увидеть процессы с активным disk I/O (если установлен и хватает permissions).

```bash
vmstat 1
```

Позволяет наблюдать системную активность и ожидание I/O; интерпретируй поля с учётом Linux и версии утилиты.

Инструменты могут быть недоступны в минимальных/managed Node. Не устанавливай пакеты и не запускай privileged debug containers в production без разрешения и согласованного runbook.

## 4. Сопоставить с Kubernetes storage

Для Pod, использующих PersistentVolume:

```bash
kubectl get pvc -A
kubectl describe pvc <pvc> -n <namespace>
kubectl get pv
kubectl describe pv <pv>
```

Проверяй:

- какой PVC и PV использует workload;
- StorageClass, provisioner и параметры volume;
- где расположен backend (локальный, сетевой, облачный, распределённый);
- есть ли другие Pod, которые используют тот же backend;
- время возникновения latency и изменения нагрузки;
- события attach/mount и сообщения CSI driver.

`kubectl describe` помогает увидеть конфигурацию и события, но не показывает полную картину performance backend-а. Для CSI и storage системы часто нужны их собственные dashboards, метрики и логи.

## 5. Метрики и мониторинг

Для Node и устройств Linux полезны метрики node exporter (если установлен):

- `node_disk_read_bytes_total` / `node_disk_written_bytes_total` — объём чтения/записи;
- `node_disk_reads_completed_total` / `node_disk_writes_completed_total` — число завершённых операций;
- `node_disk_read_time_seconds_total` / `node_disk_write_time_seconds_total` — время, затраченное на I/O;
- `node_disk_io_time_seconds_total` — время активности устройства (интерпретация зависит от устройства и драйвера).

Пример throughput чтения с устройства:

```promql
rate(node_disk_read_bytes_total[5m])
```

Пример write throughput:

```promql
rate(node_disk_written_bytes_total[5m])
```

Пример количества операций чтения в секунду:

```promql
rate(node_disk_reads_completed_total[5m])
```

Пример среднего времени чтения на операцию (приближённо, агрегировано за окно):

```promql
rate(node_disk_read_time_seconds_total[5m])
/
rate(node_disk_reads_completed_total[5m])
```

Для последних запросов учитывай деление на ноль, фильтрацию устройств и labels; реальные имена метрик зависят от версии exporter. Эти метрики не всегда дают latency отдельных запросов или p95/p99. Для storage backend (например, cloud disk, CSI, database) используй профильные метрики.

## 6. Ephemeral storage и DiskPressure

Kubernetes может учитывать local ephemeral storage для writable layer, logs и disk-backed `emptyDir`. При нехватке ресурсов kubelet способен инициировать eviction.

Проверь ресурсы Pod:

```bash
kubectl get pod <pod> -n <namespace> -o yaml
```

Ищи:

```yaml
resources:
  requests:
    ephemeral-storage: 1Gi
  limits:
    ephemeral-storage: 2Gi
```

Значения выше — пример, а не рекомендуемый размер. Requests влияют на scheduling, limits задают ограничение в рамках поддерживаемого учета, а превышение/недостаток disk space и node pressure могут привести к eviction. Учитывай особенности filesystem layout и accounting конкретной Node.

## 7. Production Support: как локализовать проблему

Если приложение стало медленнее, но CPU и memory в норме:

1. **Сравни latency приложения.** Определи, выросли ли p95/p99 и какие endpoints/операции затронуты.
2. **Сопоставь время.** Когда началась проблема? Был ли rollout, рост трафика, batch job, backup, изменение storage?
3. **Определи зависимость.** Проблема у одного Pod, Node, PVC, зоны или у всех экземпляров?
4. **Проверь disk space/inodes.** Ищи DiskPressure, рост ephemeral storage, логов и временных файлов.
5. **Проверь I/O performance.** Latency, IOPS, throughput и очередь на Node или storage backend.
6. **Найди конкурентов.** Другие Pod, database jobs, backups, batch workloads на Node или общий storage.
7. **Сравни с историей.** Текущие показатели могут выглядеть нормально после окончания пика.
8. **Проверь другие причины.** Если I/O не подтверждается, исследуй connection/thread pools, внешние сервисы, DNS, сеть и locks.

Не делай вывод «диск виноват» по одному высокому показателю. Подтверди корреляцию между I/O, latency приложения и конкретным устройством/backend.

## Пример инцидента

**Симптом:** p99 latency API вырос с 200 ms до 3 s. CPU 30%, memory стабильна, Pod не перезапускались.

Предварительные гипотезы:

- приложение ждёт disk I/O;
- database или persistent volume испытывает задержки;
- batch job создаёт конкуренцию за storage;
- заполнены filesystem/inodes, либо растёт logging;
- причина вообще не связана с диском — например, зависание на сетевом вызове или исчерпание connection pool.

Задача Support Engineer — не сразу менять ресурсы, а собрать факты: временной график latency, Node и storage metrics, events, workload на Node, PVC/backend и сравнение здорового/проблемного Pod.

## Краткие правила

- Нормальные CPU/RAM не означают, что приложение работает нормально.
- DiskPressure — проблема ресурсов/состояния диска, не синоним высокой latency.
- IOPS и throughput — разные ограничения.
- Высокий queue depth может быть симптомом конкуренции или насыщения, но требует контекста.
- Для локального диска диагностируй Node; для PV — backend storage и CSI слой.
- `kubectl top` не является инструментом измерения disk latency.
- Не меняй storage, requests/limits или scheduling до подтверждения гипотезы.

## Вопросы для самопроверки

1. Чем IOPS отличается от throughput?
2. Может ли Node не иметь DiskPressure, но storage быть медленным?
3. Почему низкий CPU может сопровождать высокую latency?
4. Что означает исчерпание inode при наличии свободного пространства?
5. Как отличить локальный Node disk bottleneck от проблем PersistentVolume backend?
6. Какие метрики ты сопоставишь с p99 latency приложения?

## Связанные материалы

- [Resources, QoS, OOMKilled и eviction](README.md)
- [CPU throttling и contention](cpu-throttling.md)
- [Memory accounting](memory-accounting.md)
- [Node Capacity, Allocatable и системные резервы](node-capacity-allocatable.md)
- [Node-pressure eviction (официальная документация)](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/)
- [Ephemeral volumes (официальная документация)](https://kubernetes.io/docs/concepts/storage/ephemeral-volumes/)
- [Persistent Volumes (официальная документация)](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
