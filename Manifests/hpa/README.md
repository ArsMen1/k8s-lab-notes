# HPA manifests

Демонстрация autoscaling/v2 для Deployment с CPU requests. Нужен metrics-server/API resource metrics; этот каталог его не устанавливает.

    kubectl apply -f Manifests/hpa/namespace.yaml
    kubectl apply -f Manifests/hpa/deployment.yaml
    kubectl apply -f Manifests/hpa/service.yaml
    kubectl apply -f Manifests/hpa/hpa.yaml
    kubectl get hpa -n lab-p1 -w

Проверь metrics API: kubectl get apiservices | grep metrics и kubectl top pods -n lab-p1. Нагрузку генерируй только в disposable кластере, HPA меняет replicas.
