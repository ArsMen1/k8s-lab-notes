# Lab: FailedMount / FailedAttachVolume

**Симптом:** Pod застрял в ContainerCreating; Events содержат FailedMount или FailedAttachVolume.

## Диагностика

    kubectl describe pod <pod> -n <namespace>
    kubectl get pvc -n <namespace>
    kubectl describe pvc <claim> -n <namespace>
    kubectl get pv
    kubectl get storageclass
    kubectl get csidrivers
    kubectl get pods -n kube-system -o wide

Проверь PVC Bound, PV node affinity, access mode, attachment limits, CSI controller/node plugin, Secret/ConfigMap references и filesystem errors.

## Root cause

Различи отсутствующий Secret/ConfigMap, unbound PVC, attach conflict, topology mismatch, driver failure и permission/filesystem issue.

## Безопасное исправление

Не удаляй PVC/PV и не делай force detach без подтверждения, что volume не используется другой Node. Исправляй доказанную dependency или передавай CSI issue владельцу storage.

## Проверка

Mount завершён, Pod Ready, приложение видит ожидаемый filesystem и данные.
