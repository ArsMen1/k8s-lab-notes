
# Kubernetes CRD — Learning Path

## Цель обучения

Научиться расширять Kubernetes API собственными ресурсами, описывать их структуру, валидировать данные и понимать, как на основе CRD строятся Kubernetes Operators.

## Уровень 1. CRD Fundamentals

1. [[01-what-is-crd]] — что такое CRD и зачем он нужен.
2. [[02-custom-resource]] — Custom Resource и его жизненный цикл.
3. [[03-crd-schema]] — OpenAPI v3 Schema.
4. [[04-validation-and-defaulting]] — Validation, Defaulting и CEL.

Результат: самостоятельно создаём собственный Kubernetes API-ресурс Database.

## Уровень 2. API Lifecycle

5. [[05-api-lifecycle]] — версии CRD, storage version и conversion webhook.

Результат: понимаем, как развивать собственный API без нарушения совместимости.

## Уровень 3. Controllers

6. [[06-controllers-and-reconciliation]] — Controller и reconciliation loop.
7. [[07-operators]] — Kubernetes Operators.

Результат: понимаем архитектуру оператора и его отличие от обычного CRD.

## Уровень 4. Production

8. [[08-helm-and-crd]] — управление CRD через Helm.

9. [[09-crd-deletion-and-data-safety]] — удаление CRD, CR, Finalizers и безопасность данных.
10. [[10-glossary]] — глоссарий терминов.
11. [[11-useful-resources]] — документация и полезные проекты.
12. [[12-learning-checklist]] — контрольный список обучения.

Результат: понимаем особенности установки, обновления и удаления CRD в реальных проектах.

## Практика

Все учебные манифесты находятся в:

`Manifests/crd/`

Порядок прохождения:

1. Установить CRD.
2. Создать Custom Resource.
3. Проверить Schema Validation.
4. Изучить версии API.
5. Разобрать архитектуру Controller.
6. Изучить Operator.
7. Разобрать установку через Helm.

## Требования

- Базовое понимание Kubernetes.
- Умение работать с YAML.
- Понимание Pod, Deployment, Service и Namespace.
- Навыки работы с kubectl.

## Критерий завершения

Ты должен уметь объяснить:

- Чем CRD отличается от CR.
- Как API Server понимает новый тип ресурса.
- Как работает OpenAPI Schema.
- Как Kubernetes проверяет Custom Resources.
- Что такое reconciliation loop.
- Зачем нужен Controller.
- Чем Operator отличается от CRD.
- Как управлять версиями собственного API.
