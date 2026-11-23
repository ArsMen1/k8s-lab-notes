# Troubleshooting labs: Node, workload и service failures

Независимые упражнения для Production Support Engineer. Начинай с read-only диагностики; изменения инфраструктуры, Node, kubelet, CSI, registry или workload выполняются только в разрешённом учебном окружении и через change process.

## Workload и сервисы

- [CrashLoopBackOff](crashloopbackoff.md)
- [Pod Running, но приложение недоступно](pod-running-but-unreachable.md)
- [Probe failures: Readiness, Liveness, Startup](probe-failures.md)
- [Container exit codes и lifecycle](container-exit-codes.md)
- [ConfigMap changes не применяются](configmap-not-updated.md)
- [Pod Evicted и Resource Pressure](pod-evicted.md)
- [Pod stuck in Terminating](pod-terminating.md)
- [Service без ready endpoints](service-no-endpoints.md)
- [PVC Pending](pvc-pending.md)
- [ImagePullBackOff](imagepullbackoff.md)

## Pod troubleshooting reference
- [Pod Troubleshooting Toolkit — read-only команды, symptom-to-check таблица и incident report](pod-troubleshooting-toolkit.md)

## Resources & performance incidents
- [CPU throttling: latency выросла, CPU выглядит невысоким](cpu-throttling.md)
- [Memory incident: OOMKilled или Node MemoryPressure](memory-oom.md)
- [Scaling incident: replicas выросли, а сервис стал хуже](scaling-worsens.md)

## Network & DNS incidents
- [DNS incident: Service name не резолбится из Pod](dns-failure.md)
- [Service connectivity: DNS есть, но TCP connection не устанавливается](service-connectivity.md)
- [NetworkPolicy incident: policy блокирует DNS или application traffic](networkpolicy-block.md)

## Observability & monitoring incidents
- [Grafana triage: найти причину деградации по графикам](grafana-triage.md)
- [Grafana practical incident: dashboard, Explore, PromQL, panels, variables и alerting](grafana-practical-incident.md)

## Node и storage incidents
- [Node NotReady](node-notready.md)
- [Pod Pending — scheduler не находит Node](scheduling-pending.md)
- [Node maintenance: cordon/drain](node-maintenance.md)
- [PDB блокирует drain](pdb-drain.md)
- [DiskPressure](diskpressure.md)
- [FailedMount / FailedAttachVolume](failedmount.md)
- [Permission denied на volume](storage-permissions.md)
- [Volume attach/detach зависает](storage-attach-detach.md)

Для каждого инцидента сохрани timeline, impact, Events, состояние объекта, подтверждённый root cause, mitigation, validation и prevention. Не делай вывод по одному симптому. Перед командами проверяй kubectl context и namespace; не выводи Secret/credentials.
