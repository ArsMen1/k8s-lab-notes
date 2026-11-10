11. Kubernetes CRD — Useful Resources

Полезная документация, инструменты и проекты для изучения CustomResourceDefinitions, Controllers и Operators.

1. Official Kubernetes Documentation

Основная документация Kubernetes.

Custom Resources
Extend the Kubernetes API with CRDs
CRD Versioning
Storage Versions
Storage Version Migration
Admission Controllers
2. Kubernetes API and Validation
OpenAPI Specification
CEL Language
Kubernetes CEL Validation

Темы для изучения:

OpenAPI Schema.
Structural Schemas.
CEL Validation Rules.
Defaulting.
Admission Webhooks.
Conversion Webhooks.
3. Controllers and Operators

Инструменты разработки Kubernetes Controllers.

Kubebuilder
Kubebuilder GitHub
Operator SDK
client-go
Controller Runtime
4. Real-world Operators

Изучай реальные реализации CRD и Controllers.

Prometheus Operator

https://github.com/prometheus-operator/prometheus-operator

Что изучать:

Prometheus CRD.
ServiceMonitor.
PodMonitor.
PrometheusRule.
Reconciliation.
CloudNativePG

https://github.com/cloudnative-pg/cloudnative-pg

Что изучать:

PostgreSQL Cluster CRD.
Управление PostgreSQL.
Репликация.
Backup и Restore.
Status и Conditions.
cert-manager

https://github.com/cert-manager/cert-manager

Что изучать:

Certificate.
Issuer.
ClusterIssuer.
Admission Webhooks.
Controller.
Argo CD

https://github.com/argoproj/argo-cd

Что изучать:

Application CRD.
ApplicationSet CRD.
Sync.
Health.
Resource Lifecycle.
5. GitOps and Argo CD
Argo CD Documentation
Argo CD Sync Options
Argo CD Sync Waves
Argo CD Automated Sync

Особенно важно изучить:

Pruning.
Self Heal.
Sync Waves.
SkipDryRunOnMissingResource.
Replace и Force.
Resource Hooks.
6. Helm and CRD
Helm Documentation
Helm Charts
Helm CRD Best Practices
7. Recommended Learning Order
Kubernetes Custom Resources.
CRD Schema and Validation.
API Versioning.
Controllers and Reconciliation.
Kubebuilder.
Operator SDK.
Real-world Operators.
Helm and GitOps.
8. Практическая рекомендация

Не ограничивайся чтением документации.

Открывай GitHub-репозитории реальных Operators и изучай:

config/crd/bases/
api/
controllers/
config/rbac/
config/manager/
