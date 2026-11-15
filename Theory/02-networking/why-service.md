# Зачем нужен Service в Kubernetes

## Проблема

Pod IP не является стабильным адресом приложения: Pod может быть пересоздан, а новый Pod получит другой IP. Для обращения к набору backend-ов обычно используют Service.

## Решение: Service

Service предоставляет стабильную точку доступа и DNS-имя. Обычный Service типа ClusterIP получает виртуальный IP; headless Service (`clusterIP: None`) не получает ClusterIP, а публикует адреса backend-ов через DNS.

## Как это работает под капотом

1. Мы создаём Service с selector, например `app: payments-api`.
2. EndpointSlice controller в control plane выбирает подходящие Pod в том же namespace.
3. Контроллер создаёт/обновляет EndpointSlice с адресами, портами и conditions backend-ов.
4. `kube-proxy` или заменяющий его dataplane использует EndpointSlice для маршрутизации трафика на готовые backend-ы.

Старый ресурс `Endpoints` поддерживается для совместимости, но deprecated начиная с Kubernetes v1.33. Для новых проверок используй EndpointSlice.

## Как формируется DNS

Обычно полное имя Service имеет вид:

`<service-name>.<namespace>.svc.<cluster-domain>`

Например, `payments-svc.default.svc.cluster.local`. `cluster.local` — распространённое значение по умолчанию, но cluster domain может быть другим.

## Полезные команды

```bash
kubectl get svc payments-svc -n <namespace> -o yaml
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=payments-svc -o yaml
kubectl describe pod <pod> -n <namespace>
```

Проверяй selector Service, labels Pod, namespace и `conditions.ready` в EndpointSlice. Наличие Service само по себе не означает, что у него есть готовые backend-ы.

## Связанные заметки

- Где хранятся backend-ы: [[where-are-endpoints-stored]]
- Labels, которыми Service выбирает Pod: [[labels-and-selectors]]
- Типы Service: [[service-types]]
- Probes влияют на готовность backend-а: [[health-probes]]

Официально: [Services](https://kubernetes.io/docs/concepts/services-networking/service/), [EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/).