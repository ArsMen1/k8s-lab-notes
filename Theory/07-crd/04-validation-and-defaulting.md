
# 04. Validation and Defaulting

## 1. Что такое Validation?

Validation — проверка корректности Custom Resource перед сохранением в Kubernetes.

Проверки могут выполняться на разных уровнях:

1. OpenAPI Schema.
2. CEL validation rules.
3. Admission Webhooks.

Каждый механизм решает определённые задачи.

## 2. OpenAPI Validation

Мы уже познакомились с enum, required, minimum и maximum.

Например:

```yaml
engine:
  type: string
  enum:
    - postgres
    - mysql
```

API Server не позволит сохранить engine: mongodb.

## 3. CEL Validation

CEL (Common Expression Language) позволяет описывать более сложные правила непосредственно в CRD.

Например:

```yaml
replicas:
  type: integer
  minimum: 1
  maximum: 10
  x-kubernetes-validations:
    - rule: "self <= 5"
      message: "replicas must not exceed 5"
```

Теперь максимальное допустимое значение дополнительно ограничено пятью.

Можно проверять взаимосвязь полей.

Например:

```yaml
x-kubernetes-validations:
  - rule: "self.minReplicas <= self.maxReplicas"
    message: "minReplicas must be less than or equal to maxReplicas"
```

Это правило применяется к объекту, в котором определены оба поля.

CEL полезен, когда обычной Schema недостаточно.

## 4. Defaulting

Defaulting позволяет автоматически задавать значение поля, если пользователь его не указал.

Например:

```yaml
version:
  type: string
  default: "17"
```

Если Custom Resource не содержит version, Kubernetes применит значение по умолчанию при обработке объекта.

Defaulting не означает, что поле становится обязательным.

## 5. Validation Webhooks

Иногда проверка требует более сложной логики.

Например:

- Проверить существование внешнего объекта.
- Выполнить сложную бизнес-валидацию.
- Проверить несколько взаимосвязанных ресурсов.
- Использовать внешние данные.

Для этого применяют Admission Webhooks.

Есть два основных типа:

- Validating Webhook — проверяет объект.
- Mutating Webhook — может изменить объект перед сохранением.

Webhook — отдельный сервис, который должен быть доступен API Server.

## 6. Сравнение

| Механизм | Назначение |
|---|---|
| OpenAPI Schema | Типы и простые ограничения |
| CEL | Выражения и дополнительные правила |
| Defaulting | Значения по умолчанию |
| Validating Webhook | Сложная проверка |
| Mutating Webhook | Изменение объекта |

## 7. Практика

Добавь в Database:

- replicas от 1 до 5;
- default version;
- CEL-правило, проверяющее взаимосвязанные поля.

Проверь:

```bash
kubectl apply -f database-crd.yaml
```

Создай корректный объект и несколько некорректных.

Смотри сообщения об ошибках:

```bash
kubectl apply -f invalid-database.yaml
```

## 8. Вопросы

1. Чем CEL отличается от OpenAPI Schema?
2. Для чего нужен default?
3. Чем Mutating Webhook отличается от Validating Webhook?
4. Когда обычной Schema недостаточно?
5. Почему Webhook может стать причиной проблем при создании ресурсов?

## 9. Практический результат

Ты должен уметь самостоятельно реализовать проверку входящих данных на уровне CRD.
