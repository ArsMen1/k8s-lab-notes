# Theory

Теория сгруппирована по темам. Практические упражнения находятся в `Manifests/` и `labs/`; перед запуском манифестов читай README соответствующего каталога.

| Трек | Содержание |
|---|---|
| `00-overview` | Основы Kubernetes, базовые объекты, [learning path](00-overview/learning-path.md), открытые вопросы |
| `01-workloads` | Pod, Deployment, ReplicaSet, DaemonSet, probes, rolling update |
| `02-networking` | Service, EndpointSlice, типы Service, путь трафика, Ingress, [API groups](02-networking/api-groups.md) |
| `03-scheduling` | Scheduler, taints, tolerations, affinity |
| `04-config` | ConfigMap, Secret, двенадцатифакторное приложение, Spring Config Server |
| `05-operations` | kubectl, диагностика, образы и порядок применения манифестов |
| `06-organization` | Namespace, labels, selectors, [annotations](06-organization/annotations-explained.md) |
| `07-crd` | CRD и CR, OpenAPI Schema, validation/defaulting, API lifecycle, controllers, operators, Helm |
| `08-cluster-admin` | kubeadm bootstrap, managed vs self-hosted, cluster upgrade, PDB |

## Что ещё нужно закрыть

Наличие темы в оглавлении не означает, что она уже изучена: сейчас это пробелы теории и/или практики, а не готовые треки.

| Приоритет | Тема | Что конкретно добавить |
|---|---|---|
| P0 | Storage: PV/PVC/StorageClass/CSI | Жизненный цикл claim, binding, access modes, reclaim policy, volume expansion, CSI и диагностика Pending/FailedMount |
| P0 | StatefulSet | Headless Service, stable identity, volumeClaimTemplates, rollout/scale и сохранность данных |
| P0 | RBAC и ServiceAccounts | Role/ClusterRole, bindings, least privilege, impersonation и проверка через kubectl auth can-i |
| P0 | Resources/QoS/Eviction | requests vs limits, QoS classes, OOMKilled, MemoryPressure/DiskPressure, ephemeral storage |
| P0 | DNS/CoreDNS и NetworkPolicy | Service discovery, DNS debugging, ingress/egress isolation и поддержка NetworkPolicy со стороны CNI |
| P1 | Ingress/TLS | Полный рабочий пример networking.k8s.io/v1, IngressClass, controller, backend endpoints, TLS Secret и диагностика 404/502 |
| P1 | Scheduling глубже | requests/allocatable, topology spread, PriorityClass/preemption, PVC topology и причины Pending |
| P1 | HPA/metrics | autoscaling/v2, metrics-server, CPU requests, scaling behavior, limits и диагностика unknown |
| P1 | Observability | Metrics/logs/traces, Prometheus/Grafana, alerting, RED/USE и связь сигналов с RCA |
| P2 | GitOps и упаковка | Helm, Kustomize, Argo CD, безопасные promotion/rollback практики |

Практический трек для части инцидентов уже добавлен: [Production Support practicum](../labs/production-support/README.md). Он не заменяет недостающие теоретические заметки и манифесты.

## Как пользоваться

- Сначала прочитай заметку и выпиши вопросы.
- Затем выполни соответствующую лабораторную работу.
- Проверь фактическое состояние через `kubectl get`, `describe`, `events`, `logs`.
- Не считай тему освоенной, пока не можешь объяснить причинно-следственную связь и диагностировать типовую поломку.

Начальная точка: [общий маршрут обучения](00-overview/learning-path.md).
