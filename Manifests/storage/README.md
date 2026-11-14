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

## Static PV и CSI StorageClass examples

Файлы с суффиксом .yaml.example намеренно не применяются через kubectl apply -f каталога.

- storageclass-template.yaml.example — шаблон StorageClass. Замени provisioner и parameters по документации установленного CSI driver. Не создавай выдуманный provisioner.
- pv-local-example.yaml.example и pvc-local-example.yaml.example — пример static local PV только для single-node disposable cluster. Нужно заранее создать каталог на node и заменить hostname. Local PV привязан к Node и не является переносимым сетевым хранилищем.

CSI Driver и CSI Nodes обычно устанавливаются/регистрируются платформенной командой или vendor chart. Проверяй их через kubectl get csidrivers и kubectl get csinodes; не пытайся создавать эти объекты как замену установке драйвера.
