# 01. What is CRD?

## 1. Что такое CRD?

CRD (CustomResourceDefinition) — механизм Kubernetes, который позволяет расширять Kubernetes API собственными типами ресурсов.

По умолчанию Kubernetes предоставляет множество встроенных ресурсов:

- Pod
- Deployment
- Service
- ConfigMap
- Secret
- StatefulSet
- DaemonSet
- Namespace
- PersistentVolume

Но представим, что мы разрабатываем платформу, в которой необходимо управлять базами данных.

Нам хотелось бы иметь возможность написать:

```yaml
apiVersion: database.example.com/v1
kind: Database
metadata:
  name: payments-db
spec:
  engine: postgres
  version: "17"
```

Проблема: Kubernetes из коробки не знает, что такое Database.

Мы можем решить эту проблему с помощью CRD.

После регистрации CRD Kubernetes API Server начинает понимать новый тип ресурса.

## 2. CRD и CR — в чём разница?

Это два разных понятия.

### CRD — CustomResourceDefinition

Описание нового типа ресурса.

Фактически мы говорим Kubernetes:

"Теперь в моём API существует новый ресурс Database".

### CR — Custom Resource

Конкретный объект, созданный на основе зарегистрированного CRD.

Например:

- payments-db
- orders-db
- analytics-db

Аналогия:

Deployment — встроенный тип ресурса.

payments-api — конкретный объект Deployment.

Database — наш новый тип ресурса.

payments-db — конкретный объект Database.

## 3. Как это работает?

Последовательность:

1. Мы создаём YAML с описанием CRD.
2. Отправляем его в Kubernetes API Server.
3. API Server регистрирует новый тип ресурса.
4. Теперь можно создавать Custom Resources.
5. API Server проверяет объекты по определённой схеме.
6. Объекты сохраняются в etcd.

Важно: CRD сам по себе не запускает никакие приложения.

Если мы создали Database с engine: postgres, PostgreSQL автоматически не появится.

Для этого необходим Controller, который будет наблюдать за ресурсами и выполнять соответствующие действия.

## 4. Где используются CRD?

CRD активно применяются в Kubernetes-экосистеме.

Примеры:

- cert-manager — Certificate, Issuer.
- Prometheus Operator — ServiceMonitor, Prometheus.
- Argo CD — Application.
- Crossplane — собственные API для инфраструктуры.
- External Secrets Operator — ExternalSecret.

CRD позволяет представить сложную инфраструктуру в виде декларативных Kubernetes-ресурсов.

## 5. Практика

Перейди в:

`Manifests/crd/01-first-crd/`

В этой директории находятся:

- database-crd.yaml
- database.yaml

Сначала регистрируем новый тип ресурса:

```bash
kubectl apply -f database-crd.yaml
```

Проверяем регистрацию:

```bash
kubectl get crd
```

Ищем:

```text
databases.lab.example.com
```

Проверяем доступность нового ресурса:

```bash
kubectl api-resources --api-group=lab.example.com
```

Создаём Custom Resource:

```bash
kubectl apply -f database.yaml
```

Проверяем:

```bash
kubectl get databases
```

Или:

```bash
kubectl get db
```

Получаем подробную информацию:

```bash
kubectl describe database payments-db
```

## 6. Что необходимо запомнить

- CRD расширяет Kubernetes API.
- CRD определяет новый тип ресурса.
- CR является экземпляром этого типа.
- API Server проверяет и сохраняет Custom Resources.
- CRD не является Controller.
- Без Controller Custom Resource остаётся объектом данных.

## 7. Вопросы для самопроверки

1. Что произойдёт, если создать Custom Resource до установки CRD?
2. В чём разница между CRD и CR?
3. Будет ли Kubernetes автоматически создавать PostgreSQL после создания Database?
4. Где хранятся Custom Resources?
5. Как проверить, что CRD зарегистрирован?

## 8. Практический результат

Ты должен самостоятельно создать новый CRD и убедиться, что Kubernetes принимает объекты нового типа.