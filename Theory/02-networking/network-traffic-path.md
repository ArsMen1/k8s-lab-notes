# Сетевой путь трафика: Service → EndpointSlice → Pod

Service предоставляет стабильную точку доступа к набору backend-ов. EndpointSlice-контроллер отслеживает Pod, подходящие под selector Service, и публикует их адреса/порты и условия готовности. Реализация data plane затем направляет трафик к подходящему endpoint.

## 1. Control plane: Service и EndpointSlice

1. При создании Service типа ClusterIP обычно выделяется виртуальный IP из Service CIDR. Headless Service (clusterIP: None) не получает ClusterIP.
2. EndpointSlice controller наблюдает Service и Pod, сопоставляет selector с labels.
3. Он создаёт/обновляет EndpointSlice. В нём содержатся адреса, порты, topology hints и conditions (например, ready/serving/terminating).
4. Readiness влияет на то, будет ли endpoint использоваться для обычной балансировки. Не своди это к утверждению, что IP обязательно исчезает из объекта.

Проверки:

    kubectl get svc <service> -n <namespace> -o yaml
    kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service> -o yaml
    kubectl get pods -n <namespace> --show-labels -o wide

## 2. Data plane: kube-proxy или его замена

Во многих кластерах kube-proxy на каждой Node следит за Service и EndpointSlice и программирует правила пересылки трафика. В зависимости от режима это могут быть iptables, IPVS или nftables.

Но kube-proxy не обязателен во всех кластерах: некоторые сетевые реализации (например, eBPF-based dataplane) заменяют его функциональность. Поэтому при диагностике сначала выясни, какой Service proxy/data plane используется в конкретном кластере.

Упрощённо путь ClusterIP-запроса:

1. Клиент отправляет пакет на ClusterIP:ServicePort.
2. Data plane выбирает подходящий endpoint.
3. Адрес назначения преобразуется/маршрутизируется к Pod IP и targetPort.
4. CNI обеспечивает передачу пакета до Pod network namespace.

Точный механизм зависит от kube-proxy mode, CNI, topology, traffic policy и реализации кластера. DNAT — распространённый механизм, но не универсальная схема для всех dataplane.

## 3. Внешний трафик

### NodePort

1. Клиент обращается к NodeIP:NodePort.
2. Service data plane обрабатывает входящий трафик и выбирает endpoint согласно Service configuration и traffic policy.
3. Endpoint может находиться на другой Node; детали source NAT и маршрутизации зависят от externalTrafficPolicy, реализации и сетевой конфигурации.

### LoadBalancer

Service типа LoadBalancer запрашивает внешний балансировщик у cloud provider или другой интегрированной реализации. Это не гарантирует одинаковый путь во всех облаках и bare-metal кластерах. В частности, NodePort allocation может быть отключён или не использоваться конкретной реализацией.

### Ingress

Ingress — HTTP/HTTPS routing API, а не Service type. Ingress Controller получает внешний трафик через собственный способ публикации (например, LoadBalancer, NodePort или host networking) и проксирует запрос на backend Service. Не предполагай, что каждый Ingress Controller обязательно использует NodePort.

## 4. Диагностика по слоям

1. **Service:** правильны ли namespace, selector, port и targetPort?
2. **EndpointSlice:** есть ли адреса ожидаемых Pod и готовы ли они?
3. **Pod:** Ready ли контейнер, слушает ли приложение нужный интерфейс и порт?
4. **NetworkPolicy:** разрешены ли source egress и destination ingress?
5. **DNS:** разрешается ли Service FQDN из namespace клиента?
6. **Data plane/CNI:** поддерживается ли NetworkPolicy, здоров ли dataplane, есть ли node-level routing issue?
7. **External entry:** корректны ли NodePort/LoadBalancer/Ingress controller и firewall/security groups?

Полезные команды:

    kubectl get svc,endpointslices -n <namespace>
    kubectl describe svc <service> -n <namespace>
    kubectl get networkpolicy -A
    kubectl get pods -A -o wide
    kubectl get events -A --sort-by=.metadata.creationTimestamp

## 5. Endpoints и EndpointSlice

Старый Endpoints API ограничен по масштабированию и не поддерживает часть новых возможностей. EndpointSlice разбивает endpoints одного Service на несколько объектов и является рекомендуемым API для service backends. В диагностике используй EndpointSlice; kubectl get endpoints оставляй как совместимый быстрый обзор.

## Связанные заметки

- [[kubectl-debug]]
- [[order-of-manifests]]
- [[service-types]]
- [[why-service]]
