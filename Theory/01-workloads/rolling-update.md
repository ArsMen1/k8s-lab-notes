# Rolling Update и Rollback

## Что делает Deployment при смене образа

1. Меняешь `image` (или другой template).
2. Deployment Controller создает **новый ReplicaSet**.
3. Постепенно поднимает новые поды и гасит старые (rolling update).
4. Старый ReplicaSet остается (history) — чтобы можно было откатить.

Это главное отличие Deployment от «голого» ReplicaSet. См. [[deployment-vs-replicaset]].

## Ключевые поля strategy

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 25%
    maxSurge: 25%
```

- `maxUnavailable` — сколько старых подов можно выключить одновременно.
- `maxSurge` — сколько новых можно создать сверх `replicas`.

## Готовность и обновление

Без **ReadinessProbe** Kubernetes может считать новый под Ready слишком рано и уже слать туда трафик. Поэтому probes и rollout связаны. См. [[health-probes]].

## Полезные команды

```bash
kubectl set image deployment/payments-api api=nginx:1.27-alpine
kubectl rollout status deployment/payments-api
kubectl rollout history deployment/payments-api
kubectl rollout undo deployment/payments-api
kubectl rollout undo deployment/payments-api --to-revision=2
kubectl rollout restart deployment/payments-api
```

`rollout restart` полезен, когда нужно пересоздать поды без смены образа (например, подтянуть новый ConfigMap в env).

## Типичные поломки

- Новый образ не стартует → rollout «зависает», часть старых подов еще жива.
- Смотри: `kubectl describe deploy`, `kubectl get rs`, `kubectl get pods`.

## Связанные заметки

- Цепочка Deployment → RS → Pod: [[deployment-vs-replicaset]]
- Отладка: [[kubectl-debug]]
