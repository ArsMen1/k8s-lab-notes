# Lab: PVC остаётся Pending

**Цель:** расследовать незавершённую привязку PersistentVolumeClaim, не подвергая данные риску.

## Сценарий

Pod, которому требуется persistent storage, не может стартовать. PVC долго находится в `Pending`. В Events PVC или Pod появляются сообщения о provisioning, binding либо отсутствии подходящего volume.

## Задача

1. Изучи PVC и его Events.
2. Проверь StorageClass, provisioner и режим binding.
3. Проверь, есть ли подходящий PV (для static provisioning) или работает ли CSI provisioner (для dynamic).
4. Сопоставь размер, access modes, storageClassName, topology и workload requirements.
5. Объясни, почему Pending может быть ожидаемым при `WaitForFirstConsumer`.
6. Предложи безопасное исправление и критерии проверки.

## Read-only диагностика

```bash
kubectl get pvc -n <namespace>
kubectl describe pvc <claim> -n <namespace>
kubectl get pv
kubectl get storageclass
kubectl describe storageclass <storage-class>
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl get pods -A -o wide
```

Проверяй CSI компоненты в namespace, который используется в твоей платформе (часто kube-system или отдельный namespace storage), а не полагайся на заранее заданное имя.

## Возможные причины

- StorageClass не существует или имя указано неверно.
- Нет подходящего PV при static provisioning.
- CSI provisioner/controller не работает или не может создать volume.
- Запрошены несовместимые size/access mode.
- Topology constraints мешают provisioning/binding.
- При `WaitForFirstConsumer` PVC может ждать scheduling Pod — это само по себе не обязательно неисправность.

## Безопасное исправление

Не удаляй PVC/PV для «пересоздания»: это может привести к потере данных. Сначала проверь reclaim policy, backup, ownership и то, используется ли volume. Исправление StorageClass, CSI или topology выполняется через согласованный change process и в учебном окружении.

## Проверка

- PVC переходит в `Bound`.
- Pod успешно scheduled и volume смонтирован.
- Приложение Ready и корректно читает/пишет данные.
- Проверка persistence после контролируемого пересоздания workload выполнена только в disposable lab с тестовыми данными.

## Разбор

Pending не всегда означает поломку: `WaitForFirstConsumer` может отложить binding до выбора Node. Сверь PVC Events, StorageClass `volumeBindingMode`, workload scheduling constraints и доступность provisioner.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
