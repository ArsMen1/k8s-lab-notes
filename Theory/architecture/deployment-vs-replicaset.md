# Deployment vs ReplicaSet vs Pod

## Цепочка создания

1. Вы применяете `Deployment`.
2. `kube-controller-manager` (Deployment Controller) создает `ReplicaSet`.
3. `ReplicaSet` создает `Pod`.
4. `kube-scheduler` назначает `Pod` на ноду.
5. `kubelet` на ноде запускает контейнер через containerd.

## Зачем нужен ReplicaSet?

Он следит за количеством реплик (desired state). Если под умирает, ReplicaSet создает новый.
Deployment — это обертка над ReplicaSet, которая позволяет делать rolling update и rollback.

## Полезные команды

- `kubectl get deploy,rs,pods` — увидеть всю цепочку сразу.
- `kubectl rollout undo deployment/имя` — откатить изменения.

## Связанные заметки:

- Почему поды не могут жить без Service: [[why-service]]
- Как работает обновление: [[rolling-update]]
- Labels у template: [[labels-and-selectors]]
