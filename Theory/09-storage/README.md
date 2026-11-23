# Kubernetes Storage: PV, PVC, StorageClass и CSI

## Модель

Kubernetes отделяет запрос приложения от реализации хранилища:
- PersistentVolume (PV) — кластерный ресурс, представляющий выделенный storage.
- PersistentVolumeClaim (PVC) — namespaced-запрос на объём, access mode и при необходимости StorageClass.
- StorageClass — описание класса динамического provisioning: provisioner, параметры, reclaimPolicy, volumeBindingMode и возможность расширения.
- CSI (Container Storage Interface) — стандартный интерфейс интеграции внешних storage drivers с Kubernetes.

PVC — не диск и не backup. Это claim, который связывается с подходящим PV или обеспечивается динамическим provisioner.

## Жизненный цикл PVC

1. Пользователь создаёт PVC с requests.storage, accessModes и опциональным storageClassName.
2. При динамическом provisioning StorageClass выбирает provisioner, который создаёт backend volume и PV.
3. Control plane связывает PVC с подходящим PV; claim переходит в Bound.
4. Pod ссылается на PVC через volumes.persistentVolumeClaim.
5. Kubelet и CSI node plugin выполняют attach/mount согласно типу тома и топологии.

PVC Pending не означает автоматически «сломался CSI». Возможны отсутствие default StorageClass, неподходящие access mode/capacity, отсутствие PV, ошибка provisioner, topology constraint или delayed binding.

## Access modes

- ReadWriteOnce (RWO) — read-write mount на одной Node; это не строго «один Pod».
- ReadOnlyMany (ROX) — read-only mount на многих Node, если backend поддерживает.
- ReadWriteMany (RWX) — read-write mount с нескольких Node, если backend поддерживает.
- ReadWriteOncePod (RWOP) — read-write mount одним Pod; требуется поддержка CSI driver и соответствующей версии.

Access mode описывает возможность mount, а не блокировки или согласованную многопользовательскую запись.

## Reclaim policy и расширение

Retain оставляет PV после удаления PVC в состоянии Released для ручного решения. Delete может удалить и PV, и связанный storage asset через provisioner. Recycle устарел и не должен использоваться в новых конфигурациях. У динамически созданного PV политика берётся из StorageClass; если не задана, обычно используется Delete.

StorageClass может разрешать увеличение через allowVolumeExpansion. Изменение requests.storage в PVC может инициировать расширение, если это поддерживают provisioner, CSI controller/node и filesystem. Уменьшение объёма не поддерживается. Retain не заменяет backup.

## Диагностика

    kubectl get sc
    kubectl get csidrivers
    kubectl get csinodes
    kubectl get pv
    kubectl get pvc -A
    kubectl describe pvc <claim> -n <namespace>
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Если PVC Pending — сначала Events claim, затем StorageClass, PV и логи provisioner/CSI controller. Если PVC Bound, но Pod не стартует — исследуй FailedAttachVolume/FailedMount, topology, CSI node plugin и Events Pod.

Связанные материалы: [StatefulSet](../10-statefulset/README.md), [Storage manifests](../../Manifests/storage/README.md), [P0 labs](../../labs/fundamentals-p0/README.md).

Официально: [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/), [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/), [CSI](https://kubernetes.io/docs/concepts/storage/volumes/#csi).

## Troubleshooting: mount, permissions и attach/detach

| Симптом | Что проверить сначала |
|---|---|
| PVC `Pending` | PVC Events, StorageClass, provisioner, PV, binding mode и topology |
| Pod `ContainerCreating` | Pod Events; отдели `FailedMount` от `FailedAttachVolume` |
| `FailedAttachVolume` / attach timeout | Node, VolumeAttachment (если применимо), CSI controller, attachment limits и backend state |
| `FailedDetachVolume` / volume busy | прежняя Node, workload, CSI и подтверждение backend detach; не force detach вслепую |
| Mount успешен, `Permission denied` | UID/GID процесса, numeric ownership, directory mode, `runAsUser`, `runAsGroup`, `fsGroup`, ACL/backend |
| Read-only filesystem | mount options, filesystem/backend status и попытка записи в правильный path |
| `No space left` | `df -h`, `df -i`, volume quota, рост файлов и inode; различай filesystem и node ephemeral storage |
| Данные исчезли/не сохранились | PVC/PV lifecycle, reclaim policy, mount path приложения, backup/restore и фактический backend |

Начинай с Events и read-only evidence. PVC `Bound` подтверждает binding, но не гарантирует attach, mount, доступ по permissions или корректность данных. Не удаляй PVC/PV и не делай force detach/chown/chmod без понимания последствий и согласования.

Практика: [Permission denied на volume](../../labs/troubleshooting/storage-permissions.md) · [Volume attach/detach зависает](../../labs/troubleshooting/storage-attach-detach.md).
