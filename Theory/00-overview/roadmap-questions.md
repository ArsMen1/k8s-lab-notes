# Вопросы для исследования (Roadmap)

Здесь я фиксирую вопросы, которые возникают по ходу обучения. Когда мы доходим до темы, я на них отвечаю.

- [ ] Как работает LoadBalancer в облаке, если у нас нет облака? (MetalLB)
- [ ] Что такое Ingress Controller и чем он отличается от Ingress? где тут истио
- [ ] Как K8s решает, на какую ноду ставить под? (Scheduler, Affinity, Taints)
- [ ] Что такое Taints и Tolerations? Зачем они нужны?
- [ ] Как работает NetworkPolicy, если CNI (например, Flannel) ее не поддерживает?
- [ ] Как обновлять StatefulSet без простоя (например, базу данных)?

- [ ] Как обновлять бд без простоя если она не в кубе а в докере?

## Связанные заметки:
* Карта обучения: [[what-is-kubernetes]]

## Практические troubleshooting labs (Production Support)

Первая тройка практических упражнений:
- [ ] [CrashLoopBackOff](../../labs/troubleshooting/crashloopbackoff.md) — предыдущие логи, Events, рестарты, гипотезы и безопасная проверка восстановления.
- [ ] [Service без ready endpoints](../../labs/troubleshooting/service-no-endpoints.md) — labels/selectors, readiness, Service ports и EndpointSlice.
- [ ] [PVC Pending](../../labs/troubleshooting/pvc-pending.md) — StorageClass, PV/PVC, CSI, topology и `WaitForFirstConsumer`.

Следующие рекомендуемые практические темы:
- [ ] OOMKilled — termination reason, предыдущие логи, memory metrics, requests/limits.
- [ ] Failed readiness/liveness probes — влияние probe на traffic и рестарты.
- [ ] Pod Pending — scheduler events, requests, taints/tolerations, affinity и quota.
- [ ] CoreDNS failure — проверка DNS из Pod и компонентов cluster DNS.
- [ ] NetworkPolicy blocking — source/destination policy, DNS egress, CNI support.
- [ ] Ingress 502/503 и TLS incident — controller, backend endpoints, certificate/Secret.
- [ ] CPU throttling и latency — метрики, saturation и корреляция.
- [ ] HPA не масштабирует — metrics API, requests, target, capacity.
- [ ] Failed rollout / rollback — безопасная диагностика релиза и recovery.
- [ ] Multi-symptom production incident — timeline, impact, evidence, root cause, mitigation, validation, prevention.
