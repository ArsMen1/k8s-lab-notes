# Lab: Volume attach/detach зависает

**Цель:** расследовать проблемы attach/detach тома, не допуская потери или повреждения данных.

## Сценарий

Pod ожидает volume, переезд workload на другую Node не завершается либо Events содержат `FailedAttachVolume`, `FailedDetachVolume`, attach timeout или сообщение о том, что volume уже используется. PVC может оставаться Bound — это не означает, что volume успешно подключён к Node.

## Задача

1. Установи, какой PVC/PV использует Pod.
2. Сравни Node, на которой Pod был/будет размещён, с фактическим состоянием attachment.
3. Проверь access mode, topology и лимиты attach для Node/backend.
4. Найди Events и состояние CSI controller/node plugin.
5. Определи безопасный план восстановления и критерии проверки.

## Read-only диагностика

```bash
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o wide
kubectl get pvc <claim> -n <namespace> -o wide
kubectl describe pvc <claim> -n <namespace>
kubectl get pv <pv> -o yaml
kubectl get volumeattachments
kubectl describe volumeattachment <volumeattachment>
kubectl get csidrivers
kubectl get pods -A -o wide
kubectl get events -A --sort-by=.metadata.creationTimestamp
```

`VolumeAttachment` — cluster-scoped ресурс, и его наличие/состояние зависит от типа volume и CSI. Для non-CSI volumes или драйверов, не использующих этот механизм, не делай выводов только по отсутствию VolumeAttachment. CSI-компоненты и их namespace определяй по фактическим ресурсам кластера.

## Возможные причины

- Volume ещё подключён к прежней Node или detach не завершился.
- CSI controller/node plugin неисправен или недоступен.
- Node недоступна, и backend не может безопасно подтвердить состояние volume.
- Attach limit Node/backend достигнут.
- Topology или access mode не допускает выбранное размещение.
- Backend storage испытывает задержку или ошибку.

## Безопасное исправление

Не удаляй вручную `VolumeAttachment`, не делай force detach и не удаляй PVC/PV для ускорения восстановления. Сначала выясни состояние Node, Pod, CSI и самого storage backend. Если volume мог быть смонтирован на другой Node, подтвердить безопасное отключение должен владелец storage/платформа. Действия с attachment/detachment выполняются только по процедуре конкретного драйвера и change process.

## Проверка

- Attachment к целевой Node завершён (если применимо).
- Mount завершился, Pod Ready.
- Приложение видит ожидаемые данные; после инцидента проверь целостность.
- Нет повторяющихся attach/detach Events.

## Ограничения учебной среды

Kind с локальным стандартным storage не воспроизводит полноценный cloud/enterprise CSI attach workflow. Эту лабораторную можно проходить как расследование по предоставленным Events и состояниям; реальную attach/detach механику проверяй только в среде с подходящим CSI driver.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Safe fix → Validation → Prevention.
