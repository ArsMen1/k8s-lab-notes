# NetworkPolicy: изоляция сетевого трафика Pod

NetworkPolicy — namespaced API object, который описывает разрешённый ingress и/или egress трафик для выбранных Pod. Сам объект не обеспечивает enforcement: установленный CNI должен поддерживать NetworkPolicy и применять правила.

## Семантика

- Policy выбирает Pod через podSelector в namespace самой policy.
- ingress ограничивает входящие соединения, egress — исходящие.
- Если Pod не изолирован policy для направления, действует allow-all по этому направлению.
- Если Pod изолирован, разрешается объединение трафика, разрешённого всеми подходящими policies.
- Для соединения могут иметь значение и egress source policy, и ingress destination policy.
- NetworkPolicy — L3/L4, не WAF, не service mesh и не HTTP authorization.

## Default deny

Policy с podSelector: {} и policyTypes: [Ingress, Egress] изолирует все Pod namespace по обоим направлениям. Без дополнительных allow rules приложение потеряет нужные соединения, включая DNS.

DNS обычно требует разрешить UDP и TCP 53 к CoreDNS Pod в kube-system. Labels и namespace нужно проверить в конкретном кластере. Поведение ipBlock на Service IP зависит от реализации dataplane; не считай его переносимым способом разрешения DNS.

## Безопасный rollout

1. Проверь CNI и поддержку NetworkPolicy.
2. Определи входящие и исходящие зависимости приложения.
3. Подготовь узкие allow policies, включая DNS и мониторинг.
4. Проверь их в отдельном тестовом namespace.
5. Только после проверки включай default deny.
6. Наблюдай flow logs/metrics, если CNI их предоставляет.

## Практические troubleshooting labs

- [NetworkPolicy incident: policy блокирует DNS или application traffic](../../labs/troubleshooting/networkpolicy-block.md)

## Диагностика

    kubectl get networkpolicy -A
    kubectl describe networkpolicy <name> -n <namespace>
    kubectl get pods -n <namespace> --show-labels
    kubectl get namespaces --show-labels
    kubectl get pods -n kube-system --show-labels

Kubernetes API не предоставляет универсальную команду для просмотра эффективной policy после enforcement; используй инструменты конкретного CNI.

Связанные материалы: [DNS/CoreDNS](../13-dns-coredns/README.md), [NetworkPolicy manifests](../../Manifests/networkpolicy/README.md), [P0 labs](../../labs/fundamentals-p0/README.md).

Официально: [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/).
