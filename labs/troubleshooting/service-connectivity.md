# Service connectivity: DNS есть, но TCP connection не устанавливается

## Симптом

Service name разрешается в IP, но клиент получает timeout, connection refused или не может подключиться. Определи, на каком уровне ломается путь.

## 1. Уточни impact

- Source Pod/namespace, destination Service/namespace/port.
- Ошибка: timeout, refused, reset, TLS error?
- Один клиент или все? Одна replica backend или все?
- Время начала, изменения rollout/policy/config.

## 2. Service и EndpointSlice — read-only

```bash
kubectl get svc <service> -n <namespace> -o yaml
kubectl describe svc <service> -n <namespace>
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service> -o wide
kubectl get pods -n <namespace> --show-labels -o wide
kubectl get pods -n <namespace> -o wide
```

Проверь selector ↔ Pod labels, Service port, targetPort, protocol, endpoint addresses и conditions (ready/serving/terminating).

## 3. Проверь target application

```bash
kubectl describe pod <backend-pod> -n <namespace>
kubectl logs <backend-pod> -n <namespace> --all-containers --tail=100
```

Уточни, действительно ли приложение слушает targetPort, и bind address (0.0.0.0 vs 127.0.0.1). Logs могут не содержать полной информации; по возможности используй application health metrics.

## 4. Проверь NetworkPolicy

```bash
kubectl get networkpolicy -A
kubectl describe networkpolicy -n <namespace>
kubectl get pods -n <namespace> --show-labels
kubectl get namespaces --show-labels
```

Проверь source egress и destination ingress policy selection. NetworkPolicy должна поддерживаться CNI; учитывай, что policy может быть в разных namespaces и оба направления могут ограничивать connection.

## 5. Проверки из клиента (если есть netcat/curl)

```bash
getent hosts <service>.<namespace>.svc.<cluster-domain>
nc -vz <service>.<namespace>.svc.<cluster-domain> <port>
curl -v --connect-timeout 3 http://<service>.<namespace>.svc.<cluster-domain>:<port>/
```

DNS, TCP и HTTP — разные проверки. `connection refused` обычно означает, что TCP активно отклонён (например, нет listener или reject); timeout может указывать на drop, routing, policy или silent failure. Это не однозначный root cause.

## 6. Диагностика data plane

Если Service/EndpointSlice/Pod/policy выглядят корректно, проверь CNI/data plane, kube-proxy или его replacement, node routing, firewall и service-specific traffic policy. Эти проверки могут потребовать прав на Node и инструментов конкретной сети.

## Safe fix и verification

Не переключай Service на другой type, не открывай allow-all NetworkPolicy и не перезапускай сетевые компоненты как первое действие. После подтверждения причины согласуй минимальное исправление. Проверяй connection с того же source Pod, success/error, latency, и несколько backend endpoints.

Сохрани timeline, impact, evidence, root cause, mitigation, verification и prevention. Все команды выше read-only.
