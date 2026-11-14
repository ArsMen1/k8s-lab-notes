# StatefulSet manifests

Демонстрация stable identity, Headless Service и отдельного PVC на каждый ordinal. Nginx показывает storage/network identity, а не production stateful-приложение.

Проверь default StorageClass. Применение:

    kubectl apply -f Manifests/statefulset/namespace.yaml
    kubectl apply -f Manifests/statefulset/headless-service.yaml
    kubectl apply -f Manifests/statefulset/statefulset.yaml
    kubectl get pods,pvc,svc -n lab-p0 -w

Ожидаемые Pod: web-0 и web-1. Для каждого ordinal появится PVC вида data-web-0 / data-web-1. Не удаляй PVC, пока данные не признаны ненужными.
