# Что и как изучать дальше

Это учебный трек под этот репозиторий. Правило: **сначала заметка → потом `kubectl apply` → потом `describe`/`logs`/`endpoints`**. Не читай теорию пачками без практики.

## Уже пройденный фундамент (этап 0)

Если эти темы понятны — можно идти дальше:

1. [[what-is-kubernetes]] — декларативность, control plane / workers
2. [[glossary-core-objects]] — карта объектов
3. [[deployment-vs-replicaset]] — цепочка Deployment → RS → Pod
4. [[why-service]] + [[where-are-endpoints-stored]]
5. [[where-is-nginx-from]]
6. [[daemonset-explained]]

Практика этапа 0:

```bash
kubectl apply -f Manifests/payments-api/
kubectl apply -f Manifests/config-server/
kubectl -n payments get deploy,rs,pods,svc
kubectl -n payments get endpointslices
```

---

## Этап 1 — связать объекты правильно (сейчас)

Цель: перестать воспринимать YAML как «магический скрипт».

| Тема             | Заметка                                                    | Практика                                               |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Labels/Selectors | [[labels-and-selectors]]                                   | сломай selector у Service и посмотри пустые Endpoints  |
| Типы Service     | [[service-types]]                                          | `Manifests/payments-api/service.yaml` и `service-nodeport.yaml` |
| Отладка          | [[kubectl-debug]] · [[cheatsheet]] · [[how-kubectl-works]] | доведи любой Broken-сценарий до причины через describe |

Критерий «сдал этап»: можешь объяснить, почему Service не видит поды, без гугления.

---

## Этап 2 — поведение приложения в проде

| Тема | Заметка | Практика |
|------|---------|----------|
| Probes | [[health-probes]] | пробы в `Manifests/payments-api/deployment.yaml`, поломка — день 5 в `labs/incidents.md` |
| Rolling update | [[rolling-update]] | день 4 в `labs/incidents.md` |
| ConfigMap/Secret | [[configmap-and-secret]] | `Manifests/payments-api/configmap.yaml` и `secret.yaml` |
| Namespaces | [[namespaces]] | `Manifests/echo/`, день 7 в `labs/incidents.md` |

Критерий: умеешь обновить образ без даунтайма и откатить; понимаешь разницу Ready vs Running.

---

## Этап 3 — дописать черновики и закрыть дыры

Черновики уже лежат, в них ещё пустые секции:

1. [[ingress-and-loadbalancer]] — Ingress Controller отдельно от объекта Ingress.
2. [[scheduling-taints-affinity]] — taints, tolerations, affinity на примерах.
3. [[spring-config-server]] — чем Config Server отличается от ConfigMap.

Дальше новых заметок ещё нет. Имеет смысл идти так:

1. ResourceQuota / LimitRange.
2. PV / PVC / StorageClass.
3. StatefulSet.
4. Job / CronJob.
5. RBAC.
6. NetworkPolicy.
7. HPA.

Открытые вопросы без заметок: [[roadmap-questions]]. Helm и операторы — после этапов 1–2 и лаборатории.

---

## Как заниматься каждый день (30–45 мин)

1. Выбери **одну** тему из таблицы.
2. Прочитай заметку.
3. Примени манифест в Killercoda / minikube / kind.
4. Либо сломай рабочий манифест сам, либо возьми день из [labs/incidents.md](../../labs/incidents.md).
5. Восстанови по [[kubectl-debug]]. Разбор дня читай после своей версии.
6. В конец заметки допиши 3–5 строк «что увидел своими глазами».

## Связанные входные точки

- Карта терминов: [[glossary-core-objects]]
- Введение: [[what-is-kubernetes]]
