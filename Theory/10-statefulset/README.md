# StatefulSet: стабильная идентичность и storage

StatefulSet управляет Pod, которым нужна стабильная идентичность, устойчивое сетевое имя, постоянное хранилище или упорядоченные операции. Если replicas взаимозаменяемы и данные хранятся вне Pod, обычно достаточно Deployment.

## Идентичность

Pod получают ordinal и предсказуемые имена: db-0, db-1, db-2. При пересоздании Pod с тем же ordinal сохраняет логическую идентичность, но не обязательно Node или сам Pod.

StatefulSet использует governing Service — обычно Headless Service с clusterIP: None. DNS-имя Pod имеет вид: <pod>.<headless-service>.<namespace>.svc.<cluster-domain>. Например, web-0.web.lab-p0.svc.cluster.local. Cluster domain может отличаться.

## volumeClaimTemplates

Для каждого шаблона StatefulSet создаёт отдельный PVC для каждого ordinal. PVC/PV переживают пересоздание Pod. По умолчанию удаление Pod, scale down или удаление StatefulSet не удаляют эти PVC.

Не путай удаление Pod с удалением PVC. После удаления PVC действует reclaim policy PV/StorageClass. В новых версиях есть persistentVolumeClaimRetentionPolicy (whenDeleted/whenScaled), но поведение зависит от версии и feature availability; проверяй целевой кластер.

## Порядок и rollout

По умолчанию PodManagementPolicy=OrderedReady: создание идёт по ordinal вверх, удаление — в обратном порядке. RollingUpdate также следует порядку. Если ранний Pod не становится Ready, прогресс может остановиться.

Parallel ослабляет порядок создания/удаления, но не делает приложение безопасным к параллельному запуску. StatefulSet не реализует репликацию данных, quorum, leader election или backup — это обязанности приложения/оператора.

## Диагностика

    kubectl get sts,pods,pvc -n <namespace> -o wide
    kubectl describe sts <name> -n <namespace>
    kubectl describe pod <name>-0 -n <namespace>
    kubectl get svc <headless-service> -n <namespace> -o yaml
    kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<headless-service>
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Проверяй selector ↔ template labels, serviceName, headless Service, PVC per ordinal, StorageClass, readiness и порядок запуска.

Практика: [StatefulSet rollout завис на одном ordinal](../../labs/troubleshooting/statefulset-rollout-stuck.md) — диагностика blocked ordinal, revisions, PVC и безопасного rollback.

Связанные материалы: [Storage](../09-storage/README.md), [StatefulSet manifests](../../Manifests/statefulset/README.md), [P0 labs](../../labs/fundamentals-p0/README.md).

Официально: [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/).
