# Зачем нужен Service в Kubernetes

## Проблема

Поды непостоянны. Если под перезапустится, он получит новый IP-адрес. Обращаться к подам напрямую по IP в продакшене нельзя — всё сломается.

## Решение: Service

Service дает **стабильный виртуальный IP (ClusterIP)** и **DNS-имя** для группы подов.

## Как это работает под капотом:

1. Мы создаем `Service` с `selector` (например, `app: payments-api`).
2. Контроллер `endpoint-controller` (внутри `kube-controller-manager`) находит все поды с таким лейблом.
3. Он создает объект `Endpoints` (или `EndpointSlice`), где записывает **актуальные IP-адреса этих подов**.
4. Объект `Endpoints` хранится в `etcd`.
5. `kube-proxy` на каждой ноде читает правила и настраивает iptables так, чтобы трафик на виртуальный IP сервиса шел на реальные IP из `Endpoints`.

## Как формируется DNS:

Kubernetes (CoreDNS) автоматически создает запись:
`<service-name>.<namespace>.svc.cluster.local`
Пример: `payments-svc.default.svc.cluster.local`

## Полезные команды:

- `kubectl get endpoints payments-svc` — посмотреть, какие IP подов привязаны к сервису.
- `kubectl describe svc payments-svc` — посмотреть детали (Selector, IP, Port).

## Связанные заметки:

- Где хранятся вычисляемые данные: [[where-are-endpoints-stored]]
