# Lab: DiskPressure и ephemeral storage

**Симптом:** Node condition DiskPressure, Pod evicted, container logs или writable layer занимают локальный диск.

## Диагностика

    kubectl describe node <node>
    kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
    kubectl describe pod <pod> -n <namespace>
    kubectl get events -A --sort-by=.metadata.creationTimestamp

Проверь nodefs/imagefs, container logs, image garbage collection, emptyDir, writable layers и ephemeral-storage requests/limits. kubectl top обычно не показывает полный disk usage; используй node/provider metrics и безопасную host диагностику.

## Root cause

Раздели imagefs/nodefs pressure, log growth, emptyDir exhaustion, накопление images и системный диск.

## Безопасное исправление

Согласуй log rotation/retention, очистку только неиспользуемых images по runtime procedure, ограничения emptyDir и корректные ephemeral-storage requests/limits. Не удаляй вручную файлы из runtime directories.

## Проверка

DiskPressure исчез, filesystem usage ниже eviction threshold, нет новых eviction, logging pipeline работает.
