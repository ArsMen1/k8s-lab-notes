# 05. CRD API Lifecycle and Versioning

## 1. Зачем нужны версии API?

Представим, что мы создали Database API:

```yaml
apiVersion: lab.example.com/v1
kind: Database
```

Через некоторое время мы понимаем, что API необходимо изменить.

Например, раньше у нас было:

```yaml
spec:
  version: "17"
```

А теперь хотим использовать более структурированную конфигурацию:

```yaml
spec:
  engine:
    type: postgres
    version: "17"
```

Возникает проблема совместимости.

Существующие клиенты всё ещё используют старую структуру.

Для решения этой задачи Kubernetes поддерживает несколько версий CRD.

## 2. served и storage

Рассмотрим:

```yaml
versions:
  - name: v1
    served: true
    storage: true

  - name: v2
    served: true
    storage: false
```

### served

Определяет, доступна ли версия через Kubernetes API.

Если served: false, API Server не обслуживает запросы к этой версии.

### storage

Определяет версию, в которой объект сохраняется в etcd.

У одного CRD только одна версия может иметь storage: true.

## 3. Несколько версий

Пример:

```yaml
versions:
  - name: v1
    served: true
    storage: false
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              version:
                type: string

  - name: v2
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              engine:
                type: string
              version:
                type: string
```

Теперь Kubernetes обслуживает обе версии.

Но это не означает, что Kubernetes самостоятельно преобразует произвольные поля между разными структурами.

Для преобразования используется conversion strategy.

## 4. Conversion Strategy

CRD поддерживает два основных варианта:

### None

```yaml
conversion:
  strategy: None
```

Kubernetes не выполняет пользовательское преобразование структуры.

Он может менять apiVersion, но это не полноценное преобразование бизнес-структуры между несовместимыми версиями.

### Webhook

```yaml
conversion:
  strategy: Webhook
  webhook:
    conversionReviewVersions:
      - v1
    clientConfig:
      service:
        namespace: system
        name: database-conversion
        path: /convert
        port: 443
```

В этом случае API Server обращается к специальному Conversion Webhook.

Webhook преобразует объект между версиями.

Например:

v1:

```yaml
spec:
  version: "17"
```

v2:

```yaml
spec:
  engine:
    type: postgres
    version: "17"
```

## 5. Storage Version Migration

Важный момент: изменение storage: true не означает, что все уже сохранённые объекты автоматически перепишутся в новую версию.

Для полноценной миграции сохранённых данных может потребоваться Storage Version Migration.

Необходимо учитывать:

- Какие версии обслуживаются.
- Какая версия является storage.
- Как работает conversion.
- Какие объекты уже существуют.
- Выполнена ли миграция старых объектов.

## 6. Почему нельзя просто переименовать v1 в v2?

Представим, что у нас есть Custom Resource:

yaml

```
apiVersion: lab.example.com/v1
kind: Database
metadata:
  name: payments-db
spec:
  engine: postgres
  version: "17"

```

Через некоторое время мы решили выпустить новую версию API:

yaml

```
apiVersion: lab.example.com/v2
kind: Database
metadata:
  name: payments-db
spec:
  database:
    engine: postgres
    version: "17"

```

На первый взгляд кажется, что достаточно изменить apiVersion.

Но проблема заключается в том, что Kubernetes хранит Custom Resources в etcd, используя определённую storage version.

Существующие объекты могут быть сохранены в старой структуре.

Если просто удалить v1 из CRD, можно потерять возможность корректно читать ранее сохранённые объекты.

## 7. Что такое spec.versions и status.storedVersions?

В CRD есть два важных механизма отслеживания версий.

### spec.versions

Определяет версии API, которые CRD обслуживает и использует для хранения.

Пример:

yaml

```
versions:
  - name: v1
    served: true
    storage: false

  - name: v2
    served: true
    storage: true

```

### status.storedVersions

Показывает версии, в которых объекты этого ресурса когда-либо сохранялись и которые ещё учитываются при управлении миграцией.

Проверить:

bash

```
kubectl get crd databases.lab.example.com \
  -o jsonpath='{.status.storedVersions}'

```

Важно: status.storedVersions не является списком всех реально существующих объектов по версиям и сам по себе не доказывает, что миграция завершена.

## 8. Пример проблемы с изменением storage version

Представим:

1. Мы создали CRD с v1.
2. Создали 100 Database объектов.
3. Все объекты записывались в etcd в формате v1.
4. Добавили v2.
5. Изменили storage: true с v1 на v2.

Что произойдёт?

Новые и обновлённые объекты будут сохраняться в новой storage version.

Но старые объекты автоматически не переписываются в etcd только из-за изменения storage: true.

При чтении Kubernetes может преобразовать объект в запрошенную served version.

Это не означает, что объект уже мигрировал в новую storage version.

## 9. Зачем нужен Conversion Webhook?

Представим две разные структуры.

v1:

yaml

```
spec:
  version: "17"

```

v2:

yaml

```
spec:
  database:
    version: "17"

```

Это уже не просто разные названия версий. Структура API изменилась.

Для преобразования данных используется Conversion Webhook.

Он должен понимать, как преобразовать v1 в v2 и обратно, если обе версии должны поддерживаться.

Важно: Conversion Webhook преобразует представление объекта между версиями API. Он не является механизмом миграции самой базы данных или внешней инфраструктуры.

## 10. Правильная последовательность обновления API

Безопасный процесс выглядит примерно так:

1. Добавить v2 в CRD.
2. Оставить v1 доступной через served: true.
3. Реализовать Conversion Webhook, если структуры несовместимы.
4. Проверить преобразование v1 в v2 и обратно.
5. Переключить storage: true на v2.
6. Выполнить миграцию существующих объектов в новую storage version.
7. Проверить завершение миграции.
8. Убедиться, что старые клиенты больше не используют v1.
9. Только после этого рассматривать удаление v1 из CRD.

Для миграции можно использовать Storage Version Migrator, если он доступен и настроен в кластере.

## 11. Почему это важно в production?

Представим, что Operator обновился, а CRD уже удалил поддержку старой версии.

При этом часть объектов всё ещё сохранена в старой storage version.

В результате можно получить проблемы с чтением и преобразованием объектов.

Поэтому обновление CRD должно рассматриваться как отдельная операция обновления API, а не как обычное переименование поля.

## 12. Вопросы

1. Что определяет storage: true?
2. Чем served отличается от storage?
3. Что показывает status.storedVersions?
4. Почему изменение storage version не переписывает автоматически все существующие объекты?
5. Для чего нужен Conversion Webhook?
6. Чем Conversion Webhook отличается от Storage Version Migration?
7. В какой момент можно безопасно удалить старую версию API?

## 13. Практический результат

Ты должен понимать, как эволюционирует Kubernetes API, как сохраняется обратная совместимость и почему миграция CRD требует отдельного плана.

## 6. Практика

Создай CRD с двумя версиями:

- v1;
- v2.

Проверь доступность:

```bash
kubectl get crd databases.lab.example.com -o yaml
```

Посмотри версии:

```bash
kubectl get crd databases.lab.example.com \
  -o jsonpath='{.spec.versions[*].name}'
```

Проверь API endpoints:

```bash
kubectl get --raw /apis/lab.example.com/v1
```

И:

```bash
kubectl get --raw /apis/lab.example.com/v2
```

## 7. Вопросы

1. Для чего нужен served?
2. Что означает storage?
3. Может ли быть две storage-версии одновременно?
4. Чем отличается None от Webhook conversion?
5. Почему нельзя просто удалить старую версию API?
6. Что такое Storage Version Migration?

## 8. Практический результат

Ты должен понимать, как развивать CRD, не ломая существующих пользователей API.
