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
## 🔍 1. Фильтрация (Поиск по лейблам)
Команды kubectl get поддерживают флаг -l (от слова label).

kubectl get pods -l app=payments-api — поды только для сервиса оплаты.
kubectl get all -l tier=backend — вообще все ресурсы (поды, сервисы, деплойменты), у которых есть метка tier=backend.
kubectl get pods -l env=prod,tier=frontend — && поды, где есть И env=prod, И tier=frontend.
kubectl get pods -l 'env in (prod, staging)' —  IN. поды в проде или на стейджинге.
kubectl get pods -l 'env notin (dev)' —  NOTIN. всё, что не в деве.
kubectl get pods -l '!app' — !. все поды, у которых вообще нет метки app.

## 🏷️ 2. Управление лейблами (Добавление и Удаление)

kubectl label pod <имя-пода> env=lab — добавить метку env=lab поду.
kubectl label pod <имя-пода> env- — **удалить** метку env (обрати внимание на дефис в конце). 
kubectl label pod <имя-пода> app=payments-api-new --overwrite — перезаписать существующую метку. Без флага --overwrite команда выдаст ошибку, если такая метка уже есть.

## 👁️ 3. Просмотр меток
kubectl get pods --show-labels — вывести список подов с колонкой всех их меток.
kubectl get pods -L app,tier — вывести метки app и tier в виде отдельных колонок (удобно для чтения).
kubectl describe pod <имя-пода> — посмотреть метки в секции Labels.
```

## ⚠️ Важный нюанс про `--overwrite`
Если ты пытаешься навесить метку, которая уже есть на объекте (например, `app=payments-api`), команда `kubectl label` завершится ошибкой. Kubernetes защищает от случайной перезаписи. Чтобы принудительно изменить значение, всегда добавляй `--overwrite`.

## Связанные заметки

- Зачем Service: [[why-service]]
- Где хранятся Endpoints: [[where-are-endpoints-stored]]
- Практика: `Manifests/payments-api/`
