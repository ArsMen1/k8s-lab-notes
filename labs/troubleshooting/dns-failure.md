# DNS incident: Service name не резолвится из Pod

## Симптом

Приложение сообщает `UnknownHost`, `Name or service not known` или DNS timeout. Нужно выяснить, проблема в настройке DNS Pod, CoreDNS Service/endpoints, NetworkPolicy или upstream.

## Impact и scope

- Уточни namespace, Pod, конкретное имя (короткое/FQDN), время и affected clients.
- Проверь: не работает только service name, cluster DNS целиком или только external domains?
- Сравни несколько Pod, если доступно.

## Read-only проверки

```bash
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get svc -n kube-system
kubectl get endpointslices -n kube-system -l kubernetes.io/service-name=<dns-service>
kubectl get pods -n kube-system --show-labels
kubectl get networkpolicy -A
```

DNS Service имя, labels и selector CoreDNS могут различаться в кластерах. Найди реальный DNS Service и его EndpointSlice, не угадывай selector.

## Проверки из Pod (если инструменты доступны)

```bash
cat /etc/resolv.conf
nslookup kubernetes.default
nslookup <service>.<namespace>.svc.<cluster-domain>
nslookup example.com
```

Подставь фактический cluster domain; `cluster.local` — распространённое значение, но не гарантировано.

## Интерпретация

- **Cluster и external DNS не работают:** Pod DNS settings, DNS Service/endpoints, CoreDNS health, NetworkPolicy, dataplane.
- **Cluster DNS работает, external нет:** upstream/forwarding, egress, external DNS policy.
- **FQDN работает, short name нет:** namespace/search domains, resolv.conf, имя Service.
- **Имя разрешается, connection timeout:** DNS уже не основной подозреваемый; исследуй Service, EndpointSlice, порт, NetworkPolicy, приложение.
- **Некоторые Pods, но не все:** сравни Node, Pod DNS config, policy selection и локальные различия.

## Root cause и безопасное исправление

Подтверди evidence: resolver config, DNS Service, EndpointSlice readiness, CoreDNS logs/metrics (если разрешено), NetworkPolicy. Не редактируй Corefile, не рестартуй CoreDNS и не меняй policy без подтверждения и согласования. DNS — общая инфраструктура; ошибочный rollout может затронуть весь кластер.

## Verification

После согласованного исправления повтори одинаковые DNS запросы из affected Pod; проверь cluster и external names отдельно, затем тестируй соединение к resolved target. Зафиксируй latency, success rate и отсутствие деградации других namespace.

**Команды в lab read-only. Не применяй изменения без разрешения.**
