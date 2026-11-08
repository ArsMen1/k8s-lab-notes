# kubectl: как дебажить, когда «ничего не работает»

Цель — не гадать, а идти по слоям: объект → события → логи → сеть.

## 1. Что вообще создалось?

```bash
kubectl get deploy,rs,pods,svc,EndpointSlice -o wide
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

### 📝 Прокачанные команды для работы с логами в Kubernetes

| Задача                              | Улучшенная команда                                        | Комментарий                                                                              |
| :---------------------------------- | :-------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Базовый просмотр**                | `kubectl logs POD_NAME -t --tail=100`                     | Добавляет **время (`-t`)** и выводит последние 100 строк (чтобы терминал не завис).      |
| **Стриминг (в реальном времени)**   | `kubectl logs POD_NAME -f -t --since=10m`                 | Живой поток логов (`-f`) с таймстемпами за последние 10 минут.                           |
| **Конкретный контейнер**            | `kubectl logs POD_NAME -c CONTAINER_NAME -f -t --tail=50` | Логи определенного контейнера в реальном времени с таймстемпами.                         |
| **Анализ падения (CrashLoop)**      | `kubectl logs POD_NAME -p -t --tail=50`                   | Флаг `-p` (`--previous`) вытягивает логи **до последнего рестарта** со временем падения. |
| **Логи по лейблу (без имени пода)** | `kubectl logs -l app=APP_LABEL -t --tail=30`              | Выводит логи сразу со **всех подов** с указанной меткой (удобно для Deployment).         |
| **Все контейнеры в поде**           | `kubectl logs POD_NAME --all-containers=true -t`          | Собирает логи со всех контейнеров внутри одного пода (включая sidecar-контейнеры).       |



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
