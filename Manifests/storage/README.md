# Storage manifests

Учебные ресурсы для PV/PVC/CSI. Применяй только в тестовом namespace после проверки подходящего default StorageClass.

    kubectl get storageclass
    kubectl get csidrivers
    kubectl get csinodes

Если default StorageClass отсутствует, PVC без storageClassName может остаться Pending. Не подставляй случайное имя класса.

    kubectl apply -f Manifests/storage/namespace.yaml
    kubectl apply -f Manifests/storage/pvc.yaml
    kubectl get pvc -n lab-p0 -w
    kubectl apply -f Manifests/storage/pod.yaml

StorageClass и CSI driver здесь не создаются: их предоставляет инфраструктура кластера. Не создавай фиктивный provisioner. Удаляй PVC только после проверки reclaimPolicy и ненужности данных.
