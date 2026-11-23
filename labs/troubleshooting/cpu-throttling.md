# CPU throttling: latency выросла, CPU выглядит невысоким

## Сценарий

API стал отвечать медленнее (p95 вырос), throughput падает. По `kubectl top` CPU не выглядит критическим. Pod не перезапускаются.

## Цель

Отличить CPU throttling из-за container limit от node-level CPU contention и от проблем вне CPU.

## 1. Зафиксируй impact и временной диапазон

- Какие endpoint/операции затронуты?
- p95/p99, error rate, throughput — до и во время инцидента.
- Один Pod или все replicas? Когда началось и совпало ли с rollout/traffic change?

## 2. Read-only сбор данных

```bash
kubectl get pods -n <namespace> -o wide
kubectl top pods -n <namespace> --containers
kubectl describe pod <pod> -n <namespace>
kubectl describe node <node>
```

Сравни CPU requests/limits всех контейнеров (включая sidecar) с фактическими метриками и историей.

## 3. Проверка throttling

Если доступны Prometheus/cAdvisor metrics, исследуй:
- `container_cpu_cfs_throttled_periods_total`
- `container_cpu_cfs_periods_total`
- `container_cpu_cfs_throttled_seconds_total`

Пример доли throttled periods за 5 минут (labels уточни под свой мониторинг):

```promql
rate(container_cpu_cfs_throttled_periods_total[5m])
/
rate(container_cpu_cfs_periods_total[5m])
```

Эта доля не является процентом потерянной производительности. Сопоставь ее с latency/throughput в тот же период.

## 4. Отличи throttling от contention

- Throttling при высоком throttled ratio и невысоком Node CPU может указывать на слишком тесный CPU limit.
- Низкий throttling, но высокая Node CPU saturation — возможен contention.
- Низкий CPU и latency — исследуй pools, очереди, locks, GC, I/O или downstream.

## 5. Безопасная mitigation (только план)

Не удаляй limit и не увеличивай его автоматически. Проверь capacity Node, соседние workloads и последствия для placement. Изменение limits/requests — через согласованный change; сравни latency, throughput, throttling и Node metrics до/после.

## 6. Verification

- latency и throughput вернулись к baseline?
- throttling снизился?
- не ухудшились ли соседние workloads?
- не возникли ли новые scheduling/pressure симптомы?

## Итог incident report

Запиши impact, timeline, evidence, гипотезы (подтверждённые и отвергнутые), root cause, mitigation, verification и prevention.

**Важно:** команды выше read-only. Никаких изменений в кластер не выполняй без разрешения.
