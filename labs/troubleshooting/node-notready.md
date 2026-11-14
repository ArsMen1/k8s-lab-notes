# Lab: Node NotReady

**Симптом:** Node Ready=False/Unknown; размещённые на ней Pod могут стать NotReady.

## Диагностика

    kubectl get nodes -o wide
    kubectl describe node <node>
    kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
    kubectl get lease -n kube-node-lease <node> -o yaml
    kubectl get events -A --sort-by=.metadata.creationTimestamp

Проверь conditions, taints, heartbeat/Lease, kubelet/runtime, CNI, disk/memory pressure и доступ control plane. В managed Kubernetes проверь provider node health events.

## Гипотезы и root cause

Раздели недоступность Node/control plane, kubelet/runtime crash, сетевую проблему, нехватку ресурсов и плановое maintenance. Подтверди причину по событиям/логам владельца инфраструктуры.

## Безопасное исправление

Не запускай drain/delete node автоматически. Сначала проверь replicas, PDB, capacity других узлов и владельца Node. Restart kubelet/Node — действие администратора платформы в согласованном change window.

## Проверка

Node Ready стабильно, system Pods healthy, workload восстановлен, повторных condition transitions нет.
