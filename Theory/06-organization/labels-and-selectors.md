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

Команды фильтрации и управления метками удобно разделять: пояснения не должны попадать в командную строку.

### 1. Фильтрация

```bash
# Точное совпадение
kubectl get pods -l app=payments-api

# Несколько условий: AND
kubectl get pods -l env=prod,tier=frontend

# Set-based selectors
kubectl get pods -l 'env in (prod,staging)'
kubectl get pods -l 'env notin (dev)'

# Объекты без label app
kubectl get pods -l '!app'

# Только часть основных типов ресурсов, не все API-ресурсы
kubectl get all -l tier=backend
```

`kubectl get all` не включает все типы ресурсов: например, Secrets и PVC нужно запрашивать отдельно.

### 2. Добавление, изменение и удаление

```bash
# Добавить новую метку
kubectl label pod <pod-name> env=lab

# Удалить метку env (дефис после имени ключа)
kubectl label pod <pod-name> env-

# Изменить уже существующую метку
kubectl label pod <pod-name> app=payments-api-new --overwrite
```

`--overwrite` нужен, когда ключ уже существует и его значение требуется изменить. Не меняй labels Pod, управляемых контроллером, если это может нарушить selector.

### 3. Просмотр меток

```bash
kubectl get pods --show-labels
kubectl get pods -L app,tier
kubectl describe pod <pod-name>
```

`-L` выводит выбранные метки отдельными колонками, а `--show-labels` — все метки в одной колонке.
## ⚠️ Важный нюанс про `--overwrite`
Если ты пытаешься навесить метку, которая уже есть на объекте (например, `app=payments-api`), команда `kubectl label` завершится ошибкой. Kubernetes защищает от случайной перезаписи. Чтобы принудительно изменить значение, всегда добавляй `--overwrite`.

## Связанные заметки

- Зачем Service: [[why-service]]
- Где хранятся Endpoints: [[where-are-endpoints-stored]]
- Практика: `Manifests/payments-api/`
