# Kubernetes CRD Lab

Практика для изучения CustomResourceDefinitions (CRD), Custom Resources (CR), схемы, валидации и версий API.

## Структура

| Каталог | Что изучаем |
|---|---|
| `01-first-crd/` | Регистрация CRD и создание первого Custom Resource |
| `02-custom-resource/` | Создание нескольких CR одного типа |
| `03-schema-validation/` | OpenAPI Schema, defaulting и CEL validation |
| `04-multiple-versions/` | Объявление нескольких API versions и storage version |
| `05-conversion-webhook/` | Пока только план лаборатории: webhook-сервис и конфигурация ещё не реализованы |

## Требования

- Доступный Kubernetes-кластер с поддержкой CRD.
- `kubectl` с контекстом нужного кластера.
- Права на создание и изменение CustomResourceDefinitions.
- Для этапа 05 дополнительно потребуются HTTPS webhook service, сертификаты и доступность webhook из API Server.

## Порядок выполнения

### 01. First CRD

```bash
kubectl apply -f 01-first-crd/database-crd.yaml
kubectl wait --for=condition=Established crd/databases.lab.example.com --timeout=60s
kubectl apply -f 01-first-crd/database.yaml
kubectl get databases
kubectl describe database payments-db
```

### 02. Несколько Custom Resources

```bash
kubectl apply -f 02-custom-resource/database.yaml
kubectl get databases
kubectl get databases -A
```

### 03. Schema, defaulting и CEL

Обнови CRD схемой из следующего этапа:

```bash
kubectl apply -f 03-schema-validation/database-crd.yaml
kubectl apply -f 03-schema-validation/valid-database.yaml
kubectl get database valid-database -o yaml
```

Затем проверь ожидаемый отказ:

```bash
kubectl apply -f 03-schema-validation/invalid-database.yaml
```

Ожидается отказ: `engine=mongodb` не входит в enum, `replicas=0` меньше минимума, а minReplicas больше maxReplicas.

Проверь defaulting, применив объект без `spec.version`, затем прочитай сохранённый объект через `kubectl get -o yaml`.

### 04. Multiple versions

```bash
kubectl apply -f 04-multiple-versions/database-crd.yaml
kubectl get crd databases.lab.example.com -o yaml
kubectl get --raw /apis/lab.example.com/v1
kubectl get --raw /apis/lab.example.com/v2
```

На этом этапе схемы v1 и v2 намеренно одинаковы. Это демонстрация нескольких served versions, а не полноценная миграция данных. Storage version — ровно одна версия с `storage: true`. Переключение `storage: true` не означает, что все ранее сохранённые объекты автоматически переписаны в etcd в новой storage version. Для реальной миграции изучи Storage Version Migration и проверяй `status.storedVersions`; не удаляй старую версию, пока данные не мигрированы и версия не перестала использоваться.

### 05. Conversion webhook — не запускать

Лаборатория пока не реализована. Для неё нужно добавить webhook-сервер, Service, TLS-сертификаты, CA bundle в CRD и тест, который доказывает реальное преобразование между несовместимыми v1 и v2. Пустой файл не является рабочей лабораторной.

## Безопасность

Не применяй все YAML из каталога одной командой: этапы изменяют одно и то же CRD. Выполняй их последовательно в отдельном учебном кластере.

Удаление CRD может удалить все Custom Resources этого типа. Перед экспериментом проверь объекты:

```bash
kubectl get databases -A
kubectl get crd databases.lab.example.com
```

Не используй эту лабораторию в production-кластере.
