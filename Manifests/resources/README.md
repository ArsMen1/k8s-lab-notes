# Resource and QoS manifests

Pod демонстрирует requests/limits CPU, memory и ephemeral-storage.

    kubectl apply -f Manifests/resources/namespace.yaml
    kubectl apply -f Manifests/resources/pod.yaml
    kubectl describe pod resource-demo -n lab-p0
    kubectl get pod resource-demo -n lab-p0 -o jsonpath='{.status.qosClass}{"\n"}'
    kubectl top pod resource-demo -n lab-p0

Ожидаемый QoS — Burstable. Не запускай искусственную OOM/eviction нагрузку на shared или production node.
