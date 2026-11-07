# Labels и Selectors — клей всего Kubernetes

## Проблема

В кластере сотни объектов. Нужен универсальный способ говорить: «вот эти поды принадлежат payments-api», «этот Service обслуживает именно их», «покажи все backend-ресурсы».

## Решение

**Label** — пара `ключ: значение` на объекте.
**Selector** — фильтр по этим меткам.

Именно labels связывают:

- Deployment → свои Pod'ы
- Service → Pod'ы для трафика
- NetworkPolicy → кого пускать
- kubectl / мониторинг → удобные выборки

## Два вида selector

1. **Equality-based** (самый частый):
   `app = payments-api`
2. **Set-based**:
   `tier in (frontend, backend)`

В YAML Deployment это выглядит так:

```yaml
selector:
  matchLabels:
    app: payments-api
```

В Service — короче:

```yaml
selector:
  app: payments-api
```

## Правило, которое ломает новичков

`Deployment.spec.selector` должен совпадать с `template.metadata.labels`.
Если после создания Deployment поменять selector — Kubernetes откажет: selector у Deployment immutable.

## Labels самого объекта ≠ labels подов

В `prod-app.yaml`:

- `metadata.labels` — метки **Deployment**
- `template.metadata.labels` — метки **Pod'ов**

Service смотрит только на метки Pod'ов.

## Полезные команды

```bash
kubectl get pods -l app=payments-api
kubectl get all -l tier=backend
kubectl label pod <имя> env=lab
kubectl label pod <имя> env-   # удалить label
```

## Связанные заметки

- Зачем Service: [[why-service]]
- Где хранятся Endpoints: [[where-are-endpoints-stored]]
- Практика: `Manifests/base-deployment/prod-app.yaml`
