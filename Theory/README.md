# Theory

Теория сгруппирована по темам. Практические упражнения находятся в `Manifests/` и `labs/`; перед запуском манифестов читай README соответствующего каталога.

| Трек | Содержание |
|---|---|
| `00-overview` | Основы Kubernetes, базовые объекты, [learning path](00-overview/learning-path.md), открытые вопросы |
| `01-workloads` | Pod, Deployment, ReplicaSet, DaemonSet, probes, rolling update |
| `02-networking` | Service, EndpointSlice, типы Service, путь трафика, Ingress, [API groups](02-networking/api-groups.md) |
| `03-scheduling` | Scheduler, taints, tolerations, affinity |
| `04-config` | ConfigMap, Secret, двенадцатифакторное приложение, Spring Config Server |
| `05-operations` | [Введение в kubectl для начинающих](05-operations/kubectl-basics.md), устройство клиента, диагностика, шпаргалка команд и порядок применения манифестов |
| `06-organization` | Namespace, labels, selectors, [annotations](06-organization/annotations-explained.md), [certificates](06-organization/certificates-in-k8s.md), [cert-manager](06-organization/cert-manager-explained.md), [rotation](06-organization/certificate-rotation.md) |
| `07-crd` | CRD и CR, OpenAPI Schema, validation/defaulting, API lifecycle, controllers, operators, Helm |
| `08-cluster-admin` | kubeadm bootstrap, managed vs self-hosted, cluster upgrade, PDB |
| `09–16` | Storage, StatefulSet, RBAC, Resources/QoS, DNS/CoreDNS, NetworkPolicy, HPA, Observability |
| `17-identity-access` | LDAP, Active Directory, OIDC, Dex, Keycloak, Kubernetes authentication и RBAC integration |

## Статус учебных треков

| Приоритет | Тема | Материалы |
|---|---|---|
| P0 | Storage: PV/PVC/StorageClass/CSI | [Теория](09-storage/README.md) · [Манифесты](../Manifests/storage/README.md) · [Лаборатории](../labs/fundamentals-p0/README.md) |
| P0 | StatefulSet | [Теория](10-statefulset/README.md) · [Манифесты](../Manifests/statefulset/README.md) · [Лаборатории](../labs/fundamentals-p0/README.md) |
| P0 | RBAC и ServiceAccounts | [Теория](11-rbac/README.md) · [Манифесты](../Manifests/rbac/README.md) · [Лаборатории](../labs/fundamentals-p0/README.md) |
| P0 | Resources/QoS/Eviction | [Теория](12-resources-qos/README.md) · [Манифесты](../Manifests/resources/README.md) · [Лаборатории](../labs/fundamentals-p0/README.md) |
| P0 | DNS/CoreDNS | [Теория](13-dns-coredns/README.md) · [Лаборатории](../labs/fundamentals-p0/README.md) |
| P0 | NetworkPolicy | [Теория](14-networkpolicy/README.md) · [Манифесты](../Manifests/networkpolicy/README.md) · [Лаборатории](../labs/fundamentals-p0/README.md) |
| P1 | Ingress/TLS | [Теория](02-networking/ingress-and-loadbalancer.md) · [Манифесты](../Manifests/ingress/README.md) · [Лаборатории](../labs/fundamentals-p1/README.md) |
| P1 | HPA/metrics | [Теория](15-hpa/README.md) · [Манифесты](../Manifests/hpa/README.md) · [Лаборатории](../labs/fundamentals-p1/README.md) |
| P1 | Observability | [Теория](16-observability/README.md) · [Runbook](../Manifests/observability/README.md) · [Лаборатории](../labs/fundamentals-p1/README.md) |
| P1 | Identity & Access Management | [Обзор](17-identity-access/README.md) · [LDAP/AD](17-identity-access/ldap-active-directory.md) · [OIDC](17-identity-access/oidc-kubernetes.md) · [Dex/Keycloak](17-identity-access/dex-keycloak.md) · [Лаборатория](../labs/identity-access/README.md) |
| P0 | Troubleshooting | [Production Support](../labs/production-support/README.md) · [P0 fundamentals](../labs/fundamentals-p0/README.md) · [standalone troubleshooting labs](../labs/troubleshooting/README.md) |

P0 означает, что теория, примеры манифестов и базовые лаборатории добавлены; их ещё нужно пройти в тестовом кластере. Для P1 добавлены theory, manifests/runbooks и лаборатории; Ingress Controller, metrics-server и Prometheus/Grafana stack остаются внешними prerequisites и не устанавливаются этим репозиторием автоматически. IAM-заметка и диагностическая лаборатория добавлены как учебные материалы; реальный LDAP/AD, Dex/Keycloak и OIDC issuer требуют отдельной среды и не разворачиваются этим репозиторием. Ни один из этих стендов не считается runtime-проверенным.

## Как пользоваться

- Сначала прочитай заметку и выпиши вопросы.
- Затем выполни соответствующую лабораторную работу.
- Проверь фактическое состояние через `kubectl get`, `describe`, `events`, `logs`.
- Не считай тему освоенной, пока не можешь объяснить причинно-следственную связь и диагностировать типовую поломку.

Начальная точка: [общий маршрут обучения](00-overview/learning-path.md).
