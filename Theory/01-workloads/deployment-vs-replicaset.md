# Deployment vs ReplicaSet vs Pod

## Цепочка создания

1. Вы применяете `Deployment`.
2. Deployment Controller в `kube-controller-manager` создаёт или обновляет `ReplicaSet`.
3. ReplicaSet Controller поддерживает требуемое количество Pod.
4. `kube-scheduler` выбирает ноду для каждого Pod.
5. `kubelet` на ноде запускает контейнер через CRI-совместимый runtime (например, containerd).

Контроллеры работают асинхронно: успешный ответ `kubectl apply` означает, что API принял объект, а не что приложение уже Ready.

## Зачем нужен ReplicaSet?

ReplicaSet сравнивает желаемое число реплик с фактическим и создаёт/удаляет Pod, чтобы привести их к заданному количеству. Deployment управляет ReplicaSet и предоставляет rollout/rollback, историю ревизий и стратегию обновления.

## Deployment vs StatefulSet

Выбор зависит не только от наличия диска, но и от идентичности реплик, порядка операций и модели хранения.

### Deployment

- **Типичный сценарий:** взаимозаменяемые stateless web/API replicas.
- **Имена Pod:** генерируются и меняются при пересоздании.
- **Порядок:** ReplicaSet не гарантирует порядок запуска или готовности реплик; планирование и запуск происходят независимо.
- **Хранилище:** если несколько реплик ссылаются на один PVC, поведение зависит от access mode и storage backend. `ReadWriteOnce` означает read-write mount на одной Node, а не обязательно одним Pod: несколько Pod на той же Node могут использовать claim, если это допускает runtime/backend. При размещении на разных Node возможна ошибка Multi-Attach. Для совместного доступа с нескольких Node нужен поддерживаемый backend и соответствующий режим, например RWX. Даже RWX сам по себе не обеспечивает согласованность данных приложения.

### StatefulSet

- **Типичный сценарий:** реплики с устойчивой ordinal identity и отдельным состоянием, например брокеры или database members.
- **Имена Pod:** предсказуемые, например `db-0`, `db-1`; при пересоздании ordinal сохраняется.
- **Порядок:** по умолчанию `OrderedReady` — создание по ordinal с ожиданием Ready; `podManagementPolicy: Parallel` меняет порядок создания/удаления. Rolling update также имеет собственную последовательность и ограничения.
- **Хранилище:** каждый `volumeClaimTemplates` создаёт отдельный PVC на ordinal. Имя формируется как `<claim-template>-<statefulset-name>-<ordinal>`, например `data-db-0`. PVC обычно переживает удаление Pod; его дальнейший lifecycle зависит от retention policy, reclaim policy и storage backend.

StatefulSet не реализует репликацию данных, quorum, leader election или backup. PVC не гарантирует, что физический диск переносим между Node: это зависит от CSI driver, topology и типа PV. Подробности: [StatefulSet](../10-statefulset/README.md) и [Storage](../09-storage/README.md).

## Полезные команды

- `kubectl get deploy,rs,pods` — увидеть цепочку Deployment → ReplicaSet → Pod.
- `kubectl rollout status deployment/<name> -n <namespace>` — дождаться завершения rollout.
- `kubectl rollout undo deployment/<name> -n <namespace>` — откатить Deployment; перед этим проверь историю и влияние на трафик.

## Связанные заметки

- Почему поды используют Service: [[why-service]]
- Как работает обновление: [[rolling-update]]
- Labels у template: [[labels-and-selectors]]
