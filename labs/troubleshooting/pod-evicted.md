# Lab: Pod Evicted и Resource Pressure

**Цель:** определить, почему Pod был evicted, и отличить ресурсное давление на Node от container resource limits и других причин завершения.

## Сценарий

Pod внезапно перестал работать. В статусе или Events видно `Evicted`. Другие Pod на той же Node тоже испытывают проблемы, либо на Node появились pressure conditions. Нужно определить, что инициировало eviction и какие workload затронуты.

## Задача

1. Зафиксируй impact: какие Pods и сервисы затронуты, когда произошёл eviction.
2. Изучи reason/message и Events Pod.
3. Проверь Node conditions и ресурсное давление.
4. Сопоставь QoS, requests/limits, usage и eviction evidence.
5. Определи безопасную mitigation, не создавая дополнительной нагрузки на кластер.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get pods -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o yaml
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl get nodes
kubectl describe node <node>
kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
kubectl top node
kubectl top pods -A
```

Если доступно, изучи workload requests/limits и QoS class. Для Node-level usage, eviction thresholds и kubelet details используй approved platform monitoring/host diagnostics; обычный `kubectl top` не показывает все причины eviction.

## Что нужно различить

- **MemoryPressure:** Node испытывает нехватку памяти; kubelet может evict Pods, выбирая кандидатов с учётом QoS, requests и превышения потребления.
- **DiskPressure / ephemeral storage:** нехватка локального диска, logs, writable layer, `emptyDir` или ephemeral-storage usage.
- **Container OOMKilled:** контейнер превысил memory limit; это не то же самое, что Pod eviction из-за Node pressure.
- **QoS:** Guaranteed, Burstable, BestEffort влияют на приоритеты при eviction; QoS сам по себе не объясняет весь выбор — учитывай фактическое потребление и requests.
- **Scheduling vs eviction:** Pod Pending из-за невозможности назначить Node — другая ситуация, чем уже запущенный Pod, удалённый kubelet.

## Возможный root cause (открывай после попытки)

Node испытывает MemoryPressure. Несколько Pods потребляют память выше своих requests; kubelet выбирает Pod для eviction. В Events подтверждено давление памяти на Node. Это не container-level OOM termination: Pod evicted в рамках защиты Node.

## Безопасное исправление

- Определи affected workload и оцени capacity оставшихся Node.
- Проверь фактическое потребление, requests/limits и возможный memory leak.
- При необходимости согласуй масштабирование или перенос workload по принятому процессу.
- Исправь requests/limits только на основании наблюдений и capacity assessment.
- Не удаляй произвольно Pods, не делай массовый restart и не очищай Node filesystem вручную.
- Если pressure связано с disk, следуй отдельному runbook [DiskPressure](diskpressure.md).

## Verification

- Node pressure condition снято или контролируемо снижается.
- Eviction не повторяется.
- Workload восстановил требуемое число replicas и Ready endpoints.
- Memory/disk usage стабилизировались.
- Не возникло перегрузки на других Node.
- Alert и мониторинг показывают восстановление.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
