# Troubleshooting labs: Node и workload failures

Четыре независимых упражнения. Выполняй read-only диагностику в учебном кластере; изменение Node, kubelet, CSI или registry выполняется только владельцем платформы через change process.

- [Node NotReady](node-notready.md)
- [DiskPressure](diskpressure.md)
- [FailedMount / FailedAttachVolume](failedmount.md)
- [ImagePullBackOff](imagepullbackoff.md)

Для каждого инцидента сохрани timeline, impact, Events, состояние объекта, подтверждённый root cause, mitigation, validation и prevention. Не делай вывод по одному симптому.
