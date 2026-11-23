# Troubleshooting labs: Node, workload и service failures

Независимые упражнения для Production Support Engineer. Начинай с read-only диагностики; изменения инфраструктуры, Node, kubelet, CSI, registry или workload выполняются только в разрешённом учебном окружении и через change process.

## Workload и сервисы

- [CrashLoopBackOff](crashloopbackoff.md)
- [Service без ready endpoints](service-no-endpoints.md)
- [PVC Pending](pvc-pending.md)
- [ImagePullBackOff](imagepullbackoff.md)

## Node и storage incidents

- [Node NotReady](node-notready.md)
- [DiskPressure](diskpressure.md)
- [FailedMount / FailedAttachVolume](failedmount.md)

Для каждого инцидента сохрани timeline, impact, Events, состояние объекта, подтверждённый root cause, mitigation, validation и prevention. Не делай вывод по одному симптому. Перед командами проверяй kubectl context и namespace; не выводи Secret/credentials.
