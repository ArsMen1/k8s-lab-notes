# Где хранятся EndpointSlice и Endpoints?

## Краткий ответ

Для Service с selector Kubernetes автоматически поддерживает backend list через объекты `EndpointSlice`. Их создаёт EndpointSlice controller в control plane; это обычные API-объекты, которые хранятся через API Server в etcd. В Git обычно описывают желаемые Service и Pod, а не динамические IP backend-ов.

Старый API `Endpoints` остаётся для совместимости, но deprecated начиная с Kubernetes v1.33. Для новых манифестов, автоматизации и диагностики используй `EndpointSlice`.

## Как это работает

1. Ты создаёшь Service с selector.
2. EndpointSlice controller наблюдает Service и Pod в том же namespace.
3. Контроллер выбирает Pod, labels которых соответствуют selector, и обновляет один или несколько EndpointSlice.
4. В EndpointSlice хранятся адреса, порты и conditions (`ready`, `serving`, `terminating`).
5. `kube-proxy` или заменяющий его dataplane использует EndpointSlice для маршрутизации Service traffic.

Service selector не выбирает Pod из других namespace. Для selectorless Service backend endpoints могут поддерживаться вручную через EndpointSlice.

## Важно про readiness

Не своди readiness к утверждению, что IP обязательно исчезает из объекта. Endpoint может остаться в EndpointSlice с `conditions.ready: false`; обычные Service proxies не направляют на него новый трафик. Для Service с `publishNotReadyAddresses: true` поведение отличается.

## Полезные команды

```bash
kubectl get svc <service> -n <namespace> -o yaml
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service> -o yaml
kubectl get pods -n <namespace> --show-labels -o wide
```

Для чтения старых runbooks можно встретить `kubectl get endpoints <service> -n <namespace>`, но не используй Endpoints API как основу новых интеграций.

## Связанные заметки

- Зачем нужен Service: [[why-service]]
- Отладка пустых backend-ов: [[kubectl-debug]]
- Путь трафика: [[network-traffic-path]]

Официально: [EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/).