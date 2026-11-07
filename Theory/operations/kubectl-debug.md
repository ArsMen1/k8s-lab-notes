# kubectl: как дебажить, когда «ничего не работает»

Цель — не гадать, а идти по слоям: объект → события → логи → сеть.

## 1. Что вообще создалось?

```bash
kubectl get deploy,rs,pods,svc,endpoints -o wide
kubectl get events --sort-by=.lastTimestamp
```

Смотри статусы подов: `Pending`, `ContainerCreating`, `CrashLoopBackOff`, `ImagePullBackOff`, `Running`.

## 2. Describe — главный инструмент

```bash
kubectl describe pod <имя>
kubectl describe deploy payments-api
kubectl describe svc payments-svc
```

Внизу `Events` почти всегда причина: нет образа, не хватает CPU/RAM, failed mount, probe failed.

## 3. Логи контейнера

```bash
kubectl logs <pod>
kubectl logs <pod> -c api          # если несколько контейнеров
kubectl logs <pod> --previous      # логи до последнего рестарта
```

## 4. Зайти внутрь

```bash
kubectl exec -it <pod> -- sh
# или bash, если есть
```

Проверки изнутри пода:

```bash
wget -qO- http://127.0.0.1:80
wget -qO- http://payments-svc
nslookup payments-svc.default.svc.cluster.local
```

## 5. Сеть и Service

```bash
kubectl get endpoints payments-svc
kubectl get endpointslices -l kubernetes.io/service-name=payments-svc
```

Если Endpoints пустой:

- не совпали labels (см. [[labels-and-selectors]]);
- поды не Ready (часто readiness probe);
- разные namespace у Service и Pod.

## 6. Частые симптомы → куда смотреть

| Симптом | Куда смотреть |
|---------|---------------|
| ImagePullBackOff | имя образа, тег, registry, pull secrets → [[where-is-nginx-from]] |
| CrashLoopBackOff | `logs --previous`, команда контейнера, конфиг |
| Pending | resources, nodeSelector/taints, PVC |
| Service не отвечает | Endpoints, labels, probe Ready |
| Rollout завис | `kubectl rollout status`, новый RS, events |

## Связанные заметки

- Шпаргалка команд: [[cheatsheet]]
- Как kubectl ходит в API: [[how-kubectl-works]]
- Probes: [[health-probes]]
- Service: [[why-service]]
- Config/Secret: [[configmap-and-secret]]
