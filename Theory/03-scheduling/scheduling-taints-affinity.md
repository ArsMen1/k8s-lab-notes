# Планирование Pod: requests, taints, affinity и topology

kube-scheduler выбирает Node для Pod, который ещё не назначен на узел. Сначала применяются фильтры допустимости (resources, taints, affinity, volume topology и другие ограничения), затем scheduler оценивает подходящие Node по scoring rules. Если подходящих узлов нет, Pod остаётся Pending; точную причину нужно читать в Events.

## 1. Requests и доступная ёмкость

Scheduler учитывает resource requests, а не фактическое текущее потребление и не limits. Для планирования сравниваются requests Pod с allocatable capacity Node за вычетом уже зарезервированных requests других Pod.

    kubectl describe pod <pod> -n <namespace>
    kubectl describe node <node>
    kubectl top nodes
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

kubectl top показывает текущие метрики и не заменяет requests/allocatable при анализе решения scheduler.

## 2. Taints и tolerations

- **Taint** задаётся на Node и ограничивает размещение Pod.
- **Toleration** в Pod разрешает ему размещаться на Node с соответствующим taint, но сама по себе не заставляет scheduler выбрать эту Node.
- Основные эффекты: NoSchedule (не размещать новые Pod), PreferNoSchedule (стараться избегать), NoExecute (не размещать и может выселять уже работающие Pod без подходящей toleration).

Проверки:

    kubectl describe node <node>
    kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints

Не добавляй toleration вслепую: taint может быть защитой control-plane или выделенного node pool.

## 3. Node selector и affinity

- **nodeSelector** — простой набор обязательных label=value условий.
- **requiredDuringSchedulingIgnoredDuringExecution** — обязательное правило node affinity; если подходящей Node нет, Pod останется Pending.
- **preferredDuringSchedulingIgnoredDuringExecution** — предпочтение при scoring, а не гарантия.
- **podAffinity/podAntiAffinity** — правила относительно других Pod.
- **topologySpreadConstraints** — распределение Pod по зонам/узлам/другим topology domains.

Сначала проверь labels узлов, затем сравни их с условиями Pod:

    kubectl get nodes --show-labels
    kubectl get pod <pod> -n <namespace> -o yaml

## 4. Диагностический алгоритм для Pending

1. Выполни describe Pod и прочитай все FailedScheduling Events.
2. Проверь requests и allocatable capacity.
3. Проверь nodeSelector, required affinity и topology spread.
4. Проверь taints и tolerations.
5. Если Pod использует PVC — проверь PVC, StorageClass и volume node affinity.
6. Проверь ResourceQuota/LimitRange в namespace.

Не уменьшай requests и не удаляй Pod только потому, что он Pending. Сначала установи конкретное ограничение и проверь, не приведёт ли изменение к деградации приложения.

## Связанные заметки

- [Что такое Kubernetes](../00-overview/what-is-kubernetes.md)
- [kubectl debugging](../05-operations/kubectl-debug.md)
- [Production Support practicum](../../labs/production-support/README.md)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Pod topology spread constraints](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/)

## 4. Node maintenance и voluntary disruption

Перед обслуживанием Node оцени workloads, доступную capacity, PDB, local storage, affinity/topology и unmanaged Pods.

- `cordon` помечает Node unschedulable для новых обычных Pods; существующие Pods остаются.
- `drain` эвакуирует Pods через механизм eviction, учитывая PDB и особенности DaemonSets/Pod.
- PDB ограничивает voluntary disruptions, но не защищает от всех отказов, и не гарантирует успешный rescheduling.
- После обслуживания Node нужно вернуть в schedulable состояние и проверить workloads, system Pods, endpoints и alerts.

**Read-only подготовка:**

```bash
kubectl get nodes -o wide
kubectl describe node <node>
kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
kubectl get pdb -A
kubectl get deploy,sts,ds -A
kubectl get events -A --sort-by=.metadata.creationTimestamp
```

Плановые `cordon`, `drain`, `uncordon` — действия изменения. Не выполняй их без change approval, capacity assessment и проверки риска local/ephemeral data. Не добавляй `--force` или `--delete-emptydir-data` как default.

Практика: [Pod Pending — scheduler](../../labs/troubleshooting/scheduling-pending.md) · [Node maintenance](../../labs/troubleshooting/node-maintenance.md) · [PDB blocks drain](../../labs/troubleshooting/pdb-drain.md).
