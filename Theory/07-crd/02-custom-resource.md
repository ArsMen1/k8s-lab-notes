
# 02. Custom Resource

## 1. Что такое Custom Resource?

Custom Resource (CR) — это объект Kubernetes, созданный на основе зарегистрированного CustomResourceDefinition.

Если CRD определяет тип ресурса, то CR представляет конкретный экземпляр этого типа.

Например, мы зарегистрировали тип Database.

Теперь можем создавать:

- payments-db
- orders-db
- reporting-db

Каждый объект является отдельным Custom Resource.

## 2. Структура Custom Resource

Рассмотрим пример:

```yaml
apiVersion: lab.example.com/v1
kind: Database
metadata:
  name: payments-db
  namespace: default
spec:
  engine: postgres
  version: "17"
```

Разберём поля.

### apiVersion

```yaml
apiVersion: lab.example.com/v1
```

Определяет API group и версию ресурса.

- lab.example.com — API group.
- v1 — версия API.

### kind

```yaml
kind: Database
```

Тип ресурса.

Он должен соответствовать kind, определённому в CRD.

### metadata

```yaml
metadata:
  name: payments-db
  namespace: default
```

Стандартная Kubernetes metadata.

Содержит имя, namespace, labels, annotations и другие поля.

### spec

```yaml
spec:
  engine: postgres
  version: "17"
```

Spec описывает желаемую конфигурацию ресурса.

В нашем примере:

- engine — тип базы данных.
- version — версия PostgreSQL.

## 3. Spec и Status

У большинства управляемых Kubernetes-ресурсов есть два важных раздела.

### Spec

Желаемое состояние.

То, чего мы хотим добиться.

### Status

Фактическое состояние.

То, что происходит в реальности.

Например:

```yaml
spec:
  engine: postgres
  version: "17"
```

Controller может создать PostgreSQL и обновить Status:

```yaml
status:
  phase: Ready
  message: Database is available
```

Важно: наличие Status не означает, что он автоматически появится или будет обновляться.

Для этого необходимо определить status subresource в CRD и реализовать Controller.

## 4. Жизненный цикл Custom Resource

Типичный процесс:

1. Создаётся CRD.
2. API Server регистрирует новый тип ресурса.
3. Создаётся Custom Resource.
4. API Server проверяет объект.
5. Объект сохраняется в etcd.
6. Controller наблюдает за объектом, если он установлен.
7. Controller выполняет необходимые действия.
8. Controller обновляет Status.

## 5. Практика

Перейди в:

`Manifests/crd/02-custom-resource/`

Применяем ресурс:

```bash
kubectl apply -f database.yaml
```

Проверяем:

```bash
kubectl get databases
```

Получаем YAML:

```bash
kubectl get database payments-db -o yaml
```

Смотрим JSON:

```bash
kubectl get database payments-db -o json
```

Проверяем API endpoint:

```bash
kubectl get --raw \
  /apis/lab.example.com/v1/namespaces/default/databases
```

Обрати внимание: Custom Resource доступен через Kubernetes API так же, как встроенные ресурсы.

## 6. Изменение ресурса

Измени версию:

```yaml
spec:
  engine: postgres
  version: "16"
```

Применяем:

```bash
kubectl apply -f database.yaml
```

Проверяем:

```bash
kubectl get database payments-db -o yaml
```

Kubernetes сохраняет новое желаемое состояние.

Но он не обновит реальную базу данных, потому что у нас пока нет Controller.

## 7. Удаление ресурса

```bash
kubectl delete database payments-db
```

Удаляется конкретный Custom Resource.

Сам CRD остаётся зарегистрированным.

Это важное отличие.

## 8. Вопросы

1. Что такое spec?
2. Что такое status?
3. Почему изменение spec не приводит к автоматическому изменению PostgreSQL?
4. Что происходит при удалении одного CR?
5. Можно ли иметь несколько CR одного типа?

## 9. Практический результат

Создай два Database:

- payments-db
- orders-db

Убедись, что оба ресурса доступны через kubectl.
