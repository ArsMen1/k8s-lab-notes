# NetworkPolicy manifests

Политики изолируют Pod в lab-p0. Перед применением проверь поддержку NetworkPolicy в CNI и реальные labels CoreDNS в kube-system. Только учебный namespace.

    kubectl apply -f Manifests/networkpolicy/namespace.yaml
    kubectl apply -f Manifests/networkpolicy/backend-pod.yaml
    kubectl apply -f Manifests/networkpolicy/frontend-pod.yaml
    kubectl apply -f Manifests/networkpolicy/default-deny.yaml
    kubectl apply -f Manifests/networkpolicy/allow-dns.yaml
    kubectl apply -f Manifests/networkpolicy/allow-frontend.yaml

Default deny блокирует egress, поэтому DNS allow обязателен. Если CoreDNS labels не совпадают с selector, DNS не заработает. Не расширяй policy до allow-all.
