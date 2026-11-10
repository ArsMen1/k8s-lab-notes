
# Kubernetes CRD Lab

Практические манифесты для изучения CustomResourceDefinitions и Custom Resources.

## Структура

| Directory | Description |
|---|---|
| 01-first-crd | Создание первого CRD и Custom Resource |
| 02-custom-resource | Создание нескольких Custom Resources |
| 03-schema-validation | OpenAPI Schema, Defaulting и CEL |
| 04-multiple-versions | Несколько версий API |
| 05-conversion-webhook | Conversion Webhook |

## Требования

- Kubernetes cluster.
- kubectl.
- Права на создание CustomResourceDefinitions.

## Порядок выполнения

### 01. First CRD

Регистрация нового API:

```bash
kubectl apply -f 01-first-crd/database-crd.yaml
```

Проверка:

```bash
kubectl wait \
  --for=condition=Established \
  crd/databases.lab.example.com \
  --timeout=60s
```

Создание Database:

```bash
kubectl apply -f 01-first-crd/database.yaml
```

Проверка:

```bash
kubectl get databases
kubectl describe database payments-db
```

### 02. Custom Resource

Создание второго объекта:

```bash
kubectl apply -f 02-custom-resource/database.yaml
```

Проверка:

```bash
kubectl get db
```

### 03. Schema Validation

Сначала обновляем CRD:

```bash
kubectl apply -f 03-schema-validation/database-crd.yaml
```

Создаём корректный объект:

```bash
kubectl apply -f 03-schema-validation/valid-database.yaml
```

Проверяем:

```bash
kubectl get database valid-database -o yaml
```

Пробуем некорректный:

```bash
kubectl apply -f 03-schema-validation/invalid-database.yaml
```

Ожидаемый результат: Kubernetes отклоняет ресурс.

## Важное предупреждение

Не применяй все YAML из каталога одной командой.

Некоторые манифесты предназначены для отдельных этапов обучения.

Удаление CRD может привести к удалению всех Custom Resources этого типа.

Перед удалением CRD проверь, какие объекты существуют:

```bash
kubectl get databases --all-namespaces
```

Не удаляй CRD в рабочем кластере без понимания последствий.
