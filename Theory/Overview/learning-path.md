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
kubectl apply -f Manifests/base-deployment/prod-app.yaml \
  -f Manifests/config-server/config-server.yaml \
  -f Manifests/service-and-dns/service.yaml \
  -f Manifests/service-and-dns/service-config-server.yaml
  
kubectl get deploy,rs,pods,svc,EndpointSlice
```

---

## Этап 1 — связать объекты правильно (сейчас)

Цель: перестать воспринимать YAML как «магический скрипт».

| Тема | Заметка | Практика |
|------|---------|----------|
| Labels/Selectors | [[labels-and-selectors]] | сломай selector у Service и посмотри пустые Endpoints |
| Типы Service | [[service-types]] | `Manifests/service-and-dns/service-nodeport.yaml` |
| Отладка | [[kubectl-debug]] · [[cheatsheet]] · [[how-kubectl-works]] | доведи любой Broken-сценарий до причины через describe |

Критерий «сдал этап»: можешь объяснить, почему Service не видит поды, без гугления.

---

## Этап 2 — поведение приложения в проде

| Тема | Заметка | Практика |
|------|---------|----------|
| Probes | [[health-probes]] | `Manifests/probes/payments-api-with-probes.yaml` |
| Rolling update | [[rolling-update]] | `kubectl set image` + `rollout undo` |
| ConfigMap/Secret | [[configmap-and-secret]] | `Manifests/config/payments-config.yaml` |
| Namespaces | [[namespaces]] | `Manifests/namespaces/lab-namespace.yaml` |

Критерий: умеешь обновить образ без даунтайма и откатить; понимаешь разницу Ready vs Running.

---

## Этап 3 — следующий слой (еще не разобран в репо)

Пиши новые заметки в таком порядке:

1. **Ingress** — HTTP-роутинг снаружи (после NodePort).
2. **ResourceQuota / LimitRange** — лимиты на namespace.
3. **PV / PVC / StorageClass** — постоянные диски.
4. **StatefulSet** — базы и стабильные имена подов.
5. **Job / CronJob** — разовые и периодические задачи.
6. **RBAC** — ServiceAccount + Role + RoleBinding.
7. **NetworkPolicy** — сетевой фаервол между подами.
8. **HPA** — автоскейл по CPU/custom metrics.

Не прыгай сразу в Helm/Operators, пока руками не пройдены этапы 1–2.

---

## Как заниматься каждый день (30–45 мин)

1. Выбери **одну** тему из таблицы.
2. Прочитай заметку.
3. Примени манифест в Killercoda / minikube / kind.
4. Сломай специально (неверный label, плохой probe, несуществующий image).
5. Восстанови по [[kubectl-debug]].
6. В конец заметки допиши 3–5 строк «что увидел своими глазами».

## Связанные входные точки

- Карта терминов: [[glossary-core-objects]]
- Введение: [[what-is-kubernetes]]
