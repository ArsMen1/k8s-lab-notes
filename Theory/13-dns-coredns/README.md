# DNS и CoreDNS в Kubernetes

## Service discovery

Типичное полное имя Service: <service>.<namespace>.svc.<cluster-domain>. Короткое имя обычно ищется в namespace Pod через search domains в resolv.conf. Не предполагай, что cluster domain всегда cluster.local.

Для ClusterIP Service DNS возвращает адрес Service. Для Headless Service DNS публикует адреса backend Pod согласно endpoint conditions и настройкам Service. StatefulSet использует Headless Service для стабильных DNS-имён Pod.

## Как работает DNS

Pod использует nameserver из /etc/resolv.conf. При типичной ClusterFirst конфигурации cluster-domain запросы идут на cluster DNS Service (часто он называется kube-dns), который обслуживает CoreDNS. CoreDNS использует Kubernetes plugin для записей Service/Pod и forward plugin для внешних доменов. Имя kube-dns — историческое имя Service, оно не обязано совпадать с именем Deployment CoreDNS.

## DNS policy

- ClusterFirst — типичное значение по умолчанию для Pod без hostNetwork.
- ClusterFirstWithHostNet — обычно нужно Pod с hostNetwork для cluster DNS.
- Default — наследует DNS настройки Node.
- None — отключает наследование и требует явной dnsConfig.

## Диагностика

    kubectl get svc -n kube-system
    kubectl get pods -n kube-system --show-labels
    kubectl get endpointslices -n kube-system -l kubernetes.io/service-name=<dns-service>
    kubectl get configmaps -n kube-system
    kubectl get configmap <coredns-configmap> -n kube-system -o yaml
    kubectl describe pod <pod> -n <namespace>

Изнутри Pod, если доступны nslookup/dig:

    cat /etc/resolv.conf
    nslookup kubernetes.default
    nslookup <service>.<namespace>.svc.<cluster-domain>
    nslookup example.com

Если не работает ни cluster, ни external DNS — проверь Pod DNS config, DNS Service/endpoints, CoreDNS и NetworkPolicy. Если cluster работает, а внешний домен нет — проверь forward/upstream. Если FQDN работает, а короткое имя нет — проверь namespace/search domains. Если DNS работает, но соединение нет — исследуй Service, EndpointSlice, NetworkPolicy и приложение.

Имя DNS Service, CoreDNS labels, Deployment, replicas и ConfigMap/Corefile отличаются между дистрибутивами. Сначала смотри реальные Service, EndpointSlice, Pod labels и ConfigMaps; подставляй фактические имена и не используй слепо selector k8s-app=kube-dns.

Не редактируй Corefile и не перезапускай DNS Pods как первый шаг: это влияет на весь кластер.

Связанные материалы: [Service networking](../02-networking/network-traffic-path.md), [NetworkPolicy](../14-networkpolicy/README.md), [P0 labs](../../labs/fundamentals-p0/README.md).

Официально: [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/), [Debugging DNS](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/).
