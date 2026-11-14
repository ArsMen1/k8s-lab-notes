# HPA manifests

Демонстрация autoscaling/v2 для Deployment с CPU requests. Нужен metrics-server/API resource metrics; этот каталог его не устанавливает.

    kubectl apply -f Manifests/hpa/namespace.yaml
    kubectl apply -f Manifests/hpa/deployment.yaml
    kubectl apply -f Manifests/hpa/service.yaml
    kubectl apply -f Manifests/hpa/hpa.yaml
    kubectl get hpa -n lab-p1 -w

Проверь metrics API: kubectl get apiservices | grep metrics и kubectl top pods -n lab-p1. Для генерации нагрузки в disposable кластере: kubectl apply -f Manifests/hpa/load-generator.yaml. После теста удали только этот Pod: kubectl delete pod load-generator -n lab-p1. Нагрузка увеличивает CPU и HPA меняет replicas; не запускай на shared/production кластере.
