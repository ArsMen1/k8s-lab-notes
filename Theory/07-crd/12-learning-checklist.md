12. CRD Learning Checklist
Stage 1. CRD Fundamentals
Прочитать 01-what-is-crd.md
Понять разницу между CRD и CR
Создать первый CustomResourceDefinition
Проверить регистрацию CRD через kubectl get crd
Проверить API через kubectl api-resources
Создать первый Custom Resource
Создать несколько CR одного типа

Результат: умею самостоятельно расширять Kubernetes API собственными ресурсами.

Stage 2. OpenAPI Schema
Прочитать 03-crd-schema.md
Изучить string, integer, number, boolean, object и array
Научиться использовать required
Научиться использовать enum
Научиться задавать minimum и maximum
Научиться использовать minLength и maxLength
Создать собственную Schema для Application

Результат: умею описывать структуру и ограничения Custom Resources.

Stage 3. Validation and Defaulting
Прочитать 04-validation-and-defaulting.md
Проверить работу OpenAPI Validation
Изучить CEL
Написать собственные CEL rules
Настроить Defaulting
Понять разницу между Mutating и Validating Webhooks
Изучить Admission Webhooks

Результат: умею контролировать корректность входящих Custom Resources.

Stage 4. API Lifecycle and Versioning
Прочитать 05-api-lifecycle.md
Изучить served и storage
Изучить status.storedVersions
Создать CRD с несколькими версиями
Изучить Conversion Webhook
Понять обратную совместимость API
Изучить Storage Version Migration
Составить план безопасного обновления v1 до v2

Результат: понимаю жизненный цикл собственного Kubernetes API.

Stage 5. Deletion and Data Safety
Прочитать 09-crd-deletion-and-data-safety.md
Понять последствия удаления CR
Понять последствия удаления CRD
Изучить Finalizers
Проверить поведение объекта с finalizer
Понять разницу между удалением CRD и Controller
Изучить Argo CD Prune
Изучить Argo CD Delete
Научиться диагностировать Sync Failed без необоснованного удаления ресурсов

Результат: умею безопасно работать с Custom Resources в production-кластере.

Stage 6. Controllers and Reconciliation
Прочитать 06-controllers-and-reconciliation.md
Понять Desired State и Actual State
Изучить reconciliation loop
Понять идемпотентность
Изучить Watches и Events
Понять Spec и Status
Изучить OwnerReferences
Смоделировать работу Controller вручную

Результат: понимаю архитектуру Kubernetes Controller.

Stage 7. Kubernetes Operators
Прочитать 07-operators.md
Изучить архитектуру Operator
Разобраться с Kubebuilder
Изучить Operator SDK
Изучить client-go
Понять RBAC для Operator
Изучить существующий PostgreSQL Operator
Разобрать его CRD и Controller

Результат: понимаю архитектуру и назначение Kubernetes Operators.

Stage 8. Helm and CRD
Прочитать 08-helm-and-crd.md
Изучить директорию crds/
Понять разницу между crds/ и templates/
Установить Helm Chart с CRD
Изучить обновление CRD
Изучить поведение CRD при helm uninstall
Понять риски удаления CRD

Результат: умею учитывать жизненный цикл CRD при работе с Helm.

Final Project
Создать собственный Database CRD
Описать Schema и Validation
Добавить несколько версий API
Реализовать Controller на Go
Использовать Kubebuilder
Реализовать reconciliation
Добавить Status
Настроить RBAC
Развернуть Operator в Kubernetes
Проверить работу через Argo CD
Подготовить Helm Chart

Финальный результат: собственный Kubernetes Operator для управления Database.

Обучение завершено

Я умею создавать собственные Kubernetes API, разрабатывать Controllers и понимать жизненный цикл Operators в production.