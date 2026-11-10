
# 03. CRD OpenAPI v3 Schema

## 1. Зачем нужна Schema?

Когда мы создаём Custom Resource, Kubernetes должен понимать, какие поля допустимы.

Например, для Database мы хотим разрешить:

```yaml
spec:
  engine: postgres
  version: "17"
```

Но не хотим принимать:

```yaml
spec:
  engine: something-random
```

Для этого CRD содержит OpenAPI v3 Schema.

Schema описывает структуру Custom Resource.

## 2. Где находится Schema?

Внутри CRD:

```yaml
spec:
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
```

openAPIV3Schema описывает допустимую структуру объекта.

## 3. Основные типы данных

OpenAPI Schema поддерживает основные JSON-типы.

### string

```yaml
engine:
  type: string
```

Строка.

### integer

```yaml
replicas:
  type: integer
```

Целое число.

### number

```yaml
storage:
  type: number
```

Число.

### boolean

```yaml
enabled:
  type: boolean
```

Логическое значение.

### object

```yaml
settings:
  type: object
  properties:
    backup:
      type: boolean
```

Объект с вложенными полями.

### array

```yaml
databases:
  type: array
  items:
    type: string
```

Массив значений.

## 4. Required

Можно сделать поле обязательным:

```yaml
required:
  - engine
```

Теперь объект без engine не пройдёт валидацию.

Важно: required относится к полям конкретного object.

Если spec отсутствует, проверка required внутри spec сама по себе не гарантирует его наличие. Для этого spec тоже необходимо указать в required родительского объекта.

## 5. Enum

Можно ограничить допустимые значения:

```yaml
engine:
  type: string
  enum:
    - postgres
    - mysql
```

Теперь допустимы только два значения.

## 6. Minimum и Maximum

Ограничения числовых значений:

```yaml
replicas:
  type: integer
  minimum: 1
  maximum: 10
```

Значение должно находиться в диапазоне от 1 до 10.

## 7. MinLength и MaxLength

Ограничение длины строки:

```yaml
databaseName:
  type: string
  minLength: 3
  maxLength: 30
```

## 8. Полная практическая схема

Посмотри файл:

`Manifests/crd/03-schema-validation/database-crd.yaml`

В нём мы ограничиваем:

- engine;
- version;
- replicas;
- storage.

Пример:

```yaml
spec:
  versions:
    - name: v1
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
                  enum:
                    - postgres
                    - mysql
                version:
                  type: string
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 10
              required:
                - engine
                - version
          required:
            - spec
```

## 9. Почему Schema важна?

Schema решает несколько задач:

- Проверка входящих данных.
- Предотвращение неправильной конфигурации.
- Описание API для клиентов.
- Поддержка корректной работы kubectl.
- Определение структуры данных для Kubernetes API.

## 10. Практика

Применяем CRD:

```bash
kubectl apply -f database-crd.yaml
```

Применяем корректный ресурс:

```bash
kubectl apply -f valid-database.yaml
```

Теперь попробуй некорректный:

```bash
kubectl apply -f invalid-database.yaml
```

Ожидаемый результат: API Server отклонит объект из-за нарушения Schema.

Попробуй самостоятельно изменить:

- engine на mongodb;
- replicas на 0;
- replicas на 100;
- удалить обязательное поле engine.

## 11. Вопросы

1. Для чего нужна OpenAPI Schema?
2. Чем required отличается от enum?
3. Какие типы данных поддерживаются?
4. Что произойдёт при попытке создать объект с неправильным типом поля?
5. Почему нельзя бездумно использовать preserveUnknownFields?

## 12. Практический результат

Создай Schema для собственного ресурса Application со следующими полями:

- image — string;
- replicas — integer от 1 до 10;
- enabled — boolean;
- environment — массив строк.
