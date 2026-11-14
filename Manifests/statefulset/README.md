# StatefulSet manifests

Демонстрация stable identity, Headless Service и отдельного PVC на каждый ordinal. Nginx показывает storage/network identity, а не production stateful-приложение.

Проверь default StorageClass. Применение:

    kubectl apply -f Manifests/statefulset/namespace.yaml
    kubectl apply -f Manifests/statefulset/headless-service.yaml
    kubectl apply -f Manifests/statefulset/statefulset.yaml
    kubectl get pods,pvc,svc -n lab-p0 -w

Ожидаемые Pod: web-0 и web-1. Для каждого ordinal появится PVC вида data-web-0 / data-web-1. Проверь файл: kubectl exec -n lab-p0 web-0 -- cat /usr/share/nginx/html/data/identity.txt. После контролируемого удаления только Pod web-0 пересозданный Pod должен читать тот же файл. Не удаляй PVC, пока данные не признаны ненужными.
