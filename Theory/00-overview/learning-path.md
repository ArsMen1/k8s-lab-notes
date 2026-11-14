# Что и как изучать дальше

Это основной маршрут репозитория. Правило: **одна тема → объяснить своими словами → выполнить практику → проверить состояние → разобрать поломку**. Не считай прочитанную заметку освоенным навыком.

## Этап 0 — фундамент

1. [[what-is-kubernetes]] — назначение Kubernetes, control plane и worker nodes.
2. [[glossary-core-objects]] — карта основных объектов.
3. [[pod-vs-container]] и [[deployment-vs-replicaset]] — Pod, Deployment и ReplicaSet.
4. [[why-service]], [[where-are-endpoints-stored]], [[service-types]] — Service и EndpointSlice.
5. [[where-is-nginx-from]] — образы и container runtime.
6. [[daemonset-explained]] — DaemonSet.

Практика:

```bash
kubectl apply -f Manifests/payments-api/
kubectl apply -f Manifests/config-server/
kubectl -n payments get deploy,rs,pods,svc
kubectl -n payments get endpointslices
```

Критерий: можешь объяснить путь от Deployment до работающего Pod и почему Service направляет трафик не на любой Pod, а на endpoints, подходящие под selector и readiness.

## Этап 1 — диагностика и поведение workloads

- [[labels-and-selectors]] — selectors и labels.
- [[health-probes]] — startup, readiness и liveness probes.
- [[rolling-update]] — rollout, history и rollback.
- [[kubectl-debug]], [[cheatsheet]], [[how-kubectl-works]] — диагностика через API, events, describe и logs.
- [[namespaces]] — область видимости ресурсов.

Практика: пройди семь сценариев из [[incidents]] и запиши для каждого симптом, гипотезу, подтверждающую команду, root cause и проверку после исправления.

Критерий: не лечишь статус по названию; умеешь определить, на каком уровне отказ — scheduling, image pull, process, readiness, Service/DNS или конфигурация.

## Этап 2 — networking и configuration

1. [[network-traffic-path]] — путь пакета через Pod, Service и node.
2. [[ingress-and-loadbalancer]] — Ingress resource, Ingress Controller и внешний балансировщик.
3. [[api-groups]] — apiVersion, API groups и discovery.
4. [[configmap-and-secret]] и [[twelve-factor-app]] — конфигурация и секреты.
5. [[spring-config-server]] — внешний Config Server и его отличие от Kubernetes ConfigMap.
6. [[scheduling-taints-affinity]] — scheduler, taints, tolerations и affinity.

Далее обязательно закрыть: PV/PVC/StorageClass, StatefulSet, Job/CronJob, ResourceQuota/LimitRange, RBAC, NetworkPolicy и HPA.

## Этап 3 — CRD и Operators

Отдельный углублённый трек: [CRD learning path](../07-crd/learning-path.md).

Порядок:
1. CRD и Custom Resource.
2. OpenAPI schema, validation, defaulting и CEL.
3. API versions, served/storage и conversion.
4. Controllers, reconciliation, spec/status и finalizers.
5. Operators, RBAC и Helm.
6. Безопасное удаление CRD/CR и последствия для данных.

Практика: `Manifests/crd/README.md`. Каталоги выполняй строго по очереди в отдельном учебном кластере: они обновляют один и тот же CRD.

Критерий: понимаешь разницу между регистрацией типа (CRD), экземпляром (CR) и управляющей логикой (Controller/Operator).

## Этап 4 — cluster administration

1. [[managed-vs-self-hosted]] — разделение ответственности.
2. [[kubeadm-bootstrap]] — bootstrap self-hosted кластера.
3. [[pod-disruption-budget]] — добровольные disruptions и drain.
4. [[cluster-upgrade]] — version skew и обновление control plane/worker nodes.

Критерий: можешь объяснить, какие компоненты и зависимости нужно проверить до обслуживания ноды или обновления кластера.

## Прикладные темы для Production Support

После основного маршрута добавляй отдельными практическими блоками:

- Storage: PV/PVC, CSI, attach/mount failures, filesystem full.
- Security: RBAC, ServiceAccount, authentication/authorization, NetworkPolicy, Pod Security.
- Observability: metrics, logs, events, traces, Prometheus/Grafana, alerting.
- Scheduling: requests/limits, QoS, eviction, node pressure, affinity.
- Networking: CoreDNS, CNI, kube-proxy/eBPF, Ingress, TLS/certificates.
- Delivery: Helm, Kustomize, GitOps/Argo CD, rollout failures.
- Reliability: PDB, HPA, autoscaling nodes, backup/restore, disaster recovery.

## Как заниматься за сессию (30–45 минут)

1. Выбери одну небольшую тему.
2. Прочитай заметку и сформулируй объяснение без подсказки.
3. Выполни практику в Killercoda, minikube, kind или отдельном тестовом кластере.
4. Проверь результат командами `get`, `describe`, `events`, `logs`, `get -o yaml`.
5. Создай контролируемую неисправность и диагностируй её.
6. Запиши 3–5 строк: симптом, причина, подтверждение, исправление, профилактика.

## Открытые вопросы

Список тем, которые ещё требуют отдельного исследования: [[roadmap-questions]].
