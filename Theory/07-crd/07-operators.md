
# 07. Kubernetes Operators

## 1. Что такое Operator?

Operator — программный компонент, который использует Kubernetes API для автоматизации управления приложением или инфраструктурой.

Обычно Operator состоит из:

- одного или нескольких CRD;
- Custom Resources;
- Controller;
- логики управления приложением.

Operator использует декларативную модель Kubernetes.

Пользователь описывает желаемое состояние, а Operator пытается его обеспечить.

## 2. CRD vs Controller vs Operator

Это не одно и то же.

### CRD

Определяет новый тип ресурса.

### Controller

Наблюдает за ресурсом и выполняет reconciliation.

### Operator

Применяет Controller-подход для автоматизации жизненного цикла определённого приложения или системы.

Например, PostgreSQL Operator может:

- создавать PostgreSQL-кластеры;
- управлять репликацией;
- выполнять backup;
- выполнять restore;
- управлять обновлениями;
- отслеживать состояние баз данных.

## 3. Архитектура Operator

```text
User
 |
 | kubectl apply
 v
Custom Resource
 |
 v
Kubernetes API Server
 |
 v
Operator Controller
 |
 +---- StatefulSet
 |
 +---- Services
 |
 +---- Secrets
 |
 +---- ConfigMaps
 |
 +---- PersistentVolumeClaims
 |
 v
Managed Application
 |
 v
Status Update
```

## 4. Пример

Пользователь создаёт:

```yaml
apiVersion: lab.example.com/v1
kind: Database
metadata:
  name: payments-db
spec:
  engine: postgres
  version: "17"
  replicas: 3
```

Operator читает объект и создаёт необходимые Kubernetes-ресурсы.

Пользователь не обязан вручную создавать StatefulSet, Service и другие зависимости.

Он управляет базой через Database API.

## 5. Как создают Operators?

Существует несколько инструментов.

### Kubebuilder

Framework для разработки Kubernetes API и Controllers на Go.

Позволяет создавать проекты, определять API, генерировать CRD и реализовывать reconciliation.

### Operator SDK

Инструментарий для разработки, тестирования и упаковки Operators.

Поддерживает различные подходы к разработке операторов.

### client-go

Низкоуровневая Go-библиотека для взаимодействия с Kubernetes API.

Позволяет самостоятельно создавать Controllers.

## 6. Как выглядит reconciliation?

Упрощённая логика на Go:

```go
func (r *DatabaseReconciler) Reconcile(
    ctx context.Context,
    req ctrl.Request,
) (ctrl.Result, error) {

    // 1. Получаем Database
    // 2. Читаем Spec
    // 3. Проверяем StatefulSet
    // 4. Создаём или обновляем StatefulSet
    // 5. Обновляем Status

    return ctrl.Result{}, nil
}
```

Это только схема. Реальный Controller также должен обрабатывать ошибки, удаления, конфликтующие обновления, статусы и повторные попытки.

## 7. RBAC

Operator работает через Kubernetes API.

Поэтому ему необходимы соответствующие права.

Например:

- get;
- list;
- watch;
- create;
- update;
- patch;
- delete.

Права задаются через Kubernetes RBAC.

Не следует выдавать Operator права cluster-admin без необходимости.

## 8. Практическое задание

Найди любой публичный Operator.

Например:

- Prometheus Operator;
- cert-manager;
- CloudNativePG.

Изучи:

1. Какие CRD он устанавливает?
2. Какие Custom Resources предоставляет?
3. Какие Deployment запускают Controller?
4. Какие права RBAC ему необходимы?
5. Какие ресурсы создаются после применения CR?

## 9. Вопросы

1. Чем Operator отличается от CRD?
2. Может ли Operator использовать несколько CRD?
3. Зачем Operator нужен Controller?
4. Какую роль выполняет RBAC?
5. Почему Operator должен быть идемпотентным?
6. Что происходит, если Controller недоступен?

## 10. Практический результат

Ты должен понимать архитектуру Kubernetes Operator и уметь проследить путь от Custom Resource до управляемого приложения.
