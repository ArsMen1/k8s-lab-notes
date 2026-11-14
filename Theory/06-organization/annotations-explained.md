# Аннотации (Annotations) в Kubernetes

Аннотации — это пары ключ/значение в `metadata.annotations`, предназначенные для хранения метаданных, которые нужны людям, контроллерам и внешним инструментам. Значения аннотаций — строки.

Главное отличие от Labels: labels предназначены в том числе для идентификации и выборки объектов через selectors; annotations не участвуют в label selectors.

## Для чего используют annotations

### 1. Настройки контроллеров и интеграций

Контроллер может читать аннотации и менять поведение. Например, Ingress Controller может интерпретировать собственные аннотации Ingress. Конкретные ключи зависят от реализации контроллера и его версии.

### 2. Метаданные для людей и автоматизации

Можно хранить описание, ссылку на runbook, идентификатор заявки или сведения об источнике конфигурации. Не помещай сюда пароли, токены и другие секреты: metadata обычно широко доступна пользователям с правом читать объект.

### 3. Служебные данные инструментов

Helm использует annotations вместе с labels для отслеживания принадлежности ресурсов release. Это метаданные учёта, а не универсальное правило «любой объект с такой аннотацией будет удалён при uninstall».

### 4. Данные kubectl apply

Классический client-side `kubectl apply` сохраняет исходную конфигурацию в аннотации `kubectl.kubernetes.io/last-applied-configuration`. Это не означает, что все способы apply обязаны использовать эту аннотацию: server-side apply использует managed fields.

## Labels vs Annotations

| Характеристика | Labels | Annotations |
|---|---|---|
| Основная задача | Идентификация и группировка | Дополнительные метаданные |
| Label selectors | Да | Нет |
| Значение | Строка с ограниченным форматом и длиной | Строка; формат значения произвольный |
| Типичное применение | app, component, environment, tier | описание, ссылки, настройки интеграций |

Аннотации не «безразмерны»: у metadata и объекта Kubernetes есть ограничения размера. Поэтому не используй annotations как хранилище больших файлов или произвольных JSON-документов.

## Пример

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  labels:
    app.kubernetes.io/name: my-app
    app.kubernetes.io/component: backend
  annotations:
    description: "Main API for payment processing"
    runbook-url: "https://wiki.example.com/runbooks/payments"
```

## Как посмотреть и изменить

```bash
kubectl get pod my-app -o yaml
kubectl get pod my-app -o jsonpath='{.metadata.annotations}'
kubectl annotate pod my-app owner="payments-team"
kubectl annotate pod my-app owner-
```

Приложение тоже может читать аннотации через Kubernetes API, если ему это явно реализовано и выданы необходимые RBAC-права. Но для передачи настроек внутрь контейнера обычно проще и прозрачнее использовать ConfigMap, Secret или environment variables.

## Связанные заметки

- [[labels-and-selectors]]
- [[twelve-factor-app]]
- [[configmap-and-secret]]
- [[cert-manager-explained]]
