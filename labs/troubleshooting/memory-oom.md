# Memory incident: OOMKilled или Node MemoryPressure

## Сценарий

Контейнер периодически перезапускается либо Pod удаляются/evicted. Нужно выяснить, container memory limit это или node-wide pressure.

## 1. Уточни impact и scope

- Какой workload/container пострадал?
- Restart count, время первых рестартов, affected replicas.
- Одинаковый симптом на одной Node или на разных?

## 2. Проверь состояние Pod

```bash
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o jsonpath='{range .status.containerStatuses[*]}{.name}{" reason="}{.lastState.terminated.reason}{" exitCode="}{.lastState.terminated.exitCode}{" restartCount="}{.restartCount}{"\n"}{end}'
```

Ищи `OOMKilled`, exit code 137 (сам по себе не доказывает OOM), restart count, Events и timestamps.

## 3. Раздели две основные причины

**Container-level OOM:** контейнер достиг memory cgroup limit или был выбран OOM killer. Сопоставь memory trend, limit, cgroup events, logs и application heap/native memory.

**Node MemoryPressure / eviction:** kubelet испытывает memory pressure на Node и может evict Pod. Проверь Node conditions и события:

```bash
kubectl describe node <node>
kubectl get events -A --sort-by=.metadata.creationTimestamp
```

Не путай `OOMKilled` (termination reason контейнера), `Evicted` (Pod удалён kubelet) и `MemoryPressure` (Node condition).

## 4. Сравни память и нагрузку во времени

Read-only:

```bash
kubectl top pod -n <namespace> --containers
kubectl top node
```

Текущие значения не заменяют исторические графики. Сопоставь working set/usage, memory limit, traffic, restarts, deployment/config changes. Если доступно, исследуй heap/GC, caches, connection pools, native memory и cgroup `memory.events` с разрешённым node-level доступом.

## 5. Mitigation — не угадывай

Не увеличивай memory limit без оценки Node capacity и memory requests. Не снижай requests только чтобы scheduler разместил Pod. Возможные действия (только после подтверждения root cause и согласования): ограничить/снизить входную нагрузку, откатить регрессию, скорректировать leak/cache/pool, изменить ресурсы или распределить workload.

## 6. Verification

Подтверди: OOM/eviction прекратились, memory trend стабилизировался, replicas Ready, пользовательские метрики восстановились, Node не перешёл в pressure, соседние workloads не пострадали.

## Incident report

Impact → timeline → evidence → root cause → mitigation → verification → prevention.

Все команды в упражнении диагностические/read-only; никаких изменений в кластере не выполняй без разрешения.
