# CPU throttling и CPU contention

## Почему Pod может тормозить при невысоком CPU

CPU — сжимаемый ресурс: контейнер может быть ограничен квотой CPU (throttling), ждать CPU из-за конкуренции на node (contention), либо приложение может задерживаться по причинам, не связанным с CPU. Поэтому `kubectl top` с небольшим текущим CPU не доказывает, что CPU не является причиной latency.

Разделяет две ситуации:

- **CPU throttling** — cgroup ограничивает время CPU, доступное контейнеру/группе процессов в заданном периоде, потому что исчерпана квота.
- **CPU contention** — процессы конкурируют за доступные CPU. Даже без CPU limit workload может ждать, когда CPU занят другими процессами.

Это разные причины, и их диагностические признаки отличаются.

## CPU request и limit: роль в поведении

- `requests.cpu` — планировочный запрос: scheduler учитывает его при размещении Pod. Request не резервирует физическое ядро эксклюзивно и не ограничивает максимальное потребление.
- `limits.cpu` — верхняя граница времени CPU, выделяемого cgroup в среднем по периодам. При исчерпании квоты контейнер throttled до следующего периода.
- CPU limit — не «количество ядер, закреплённых за Pod». При limit `500m` процесс может кратковременно работать параллельно на нескольких ядрах, но суммарно ограничен квотой.
- CPU limit не вызывает OOMKilled и сам по себе не завершает контейнер. Он может приводить к задержкам, снижению throughput и росту latency.

## Как работает throttling (CFS quota)

На Linux CPU limits обычно реализуются механизмом CFS bandwidth control. В упрощённом виде kubelet/runtime задают cgroup CPU quota и period.

Например, при CPU limit `500m` и period `100ms` контейнер получает примерно `50ms` суммарного CPU-времени на каждый 100ms период. Это квота CPU-time, а не обязательно половина одного конкретного ядра. Если workload использует квоту раньше конца периода, ему могут ограничить дальнейшее исполнение до следующего периода.

Важно: точные параметры и отображение в cgroup зависят от Linux kernel, runtime и cgroup v1/v2; не полагайся на фиксированные значения period, проверяй конкретную node/container.

## Пример манифеста

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cpu-limited-demo
spec:
  containers:
    - name: app
      image: nginx:1.27
      resources:
        requests:
          cpu: 100m
        memory: 64Mi
        limits:
          cpu: 500m
          memory: 128Mi
```

В этом примере scheduler учитывает CPU request `100m`, а cgroup limit ограничивает CPU до `500m`. Если приложение создаёт интенсивную CPU-нагрузку и упирается в квоту, оно может throttled. Сам факт, что limit выше request, не исключает throttling.

## Симптомы

- Время ответа сервиса выросло, хотя текущий CPU в `kubectl top` выглядит умеренным.
- Throughput падает при росте запросов.
- CPU limit невысокий, а контейнер часто throttled.
- Снижение CPU limit/request или изменение конфигурации совпало с ухудшением latency.
- Один Pod страдает, хотя на node есть свободный CPU (возможна quota); или несколько Pod страдают одновременно (возможна node contention).

Не считай эти симптомы доказательством: проверяй метрики и сопоставляй их с периодом инцидента.

## Диагностика: порядок действий

### 1. Сопоставь latency/throughput с ресурсами

```bash
kubectl top pod -n <namespace> --containers
kubectl describe pod <pod> -n <namespace>
kubectl describe node <node>
kubectl get pod <pod> -n <namespace> -o wide
```

`kubectl top` показывает текущие значения, а не историю и не peak. Для расследования инцидента используй временные ряды мониторинга, если они доступны.

### 2. Проверь requests и limits

```bash
kubectl get pod <pod> -n <namespace> -o jsonpath='{range .spec.containers[*]}{.name}{" requests="}{.resources.requests.cpu}{" limits="}{.resources.limits.cpu}{"\n"}{end}'
```

Проверь все контейнеры Pod, включая sidecar. Не сравнивай только приложение, если ресурсы ограничены у другого контейнера.

### 3. Ищи throttling в метриках контейнера

В Prometheus/cAdvisor часто доступны метрики (имена могут отличаться в зависимости от версии, сборщика и relabeling):

- `container_cpu_cfs_periods_total` — количество периодов CFS, в которых контейнер получил квоту.
- `container_cpu_cfs_throttled_periods_total` — количество периодов, в которых container был throttled.
- `container_cpu_cfs_throttled_seconds_total` — накопленное время throttling, если метрика экспортируется.
- `container_cpu_usage_seconds_total` — накопленное CPU-time; по rate можно получить CPU usage.

Пример PromQL — доля периодов, в которых был throttling, за последние 5 минут:

```promql
rate(container_cpu_cfs_throttled_periods_total[5m])
/
rate(container_cpu_cfs_periods_total[5m])
```

Фильтры по namespace/pod/container добавь под свою схему labels. Защити запрос от деления на ноль при отсутствии данных. Это доля throttled periods, а **не процент потерянной производительности или времени CPU**.

Пример CPU usage в cores:

```promql
rate(container_cpu_usage_seconds_total[5m])
```

### 4. Проверь node-level contention

Сопоставь Pod-метрики с состоянием Node:

```bash
kubectl describe node <node>
kubectl top node
kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
```

Ищи CPU saturation, нагрузку других workloads, процессы на node, а также показатели host CPU (idle, iowait, steal — если доступны в node exporter/OS). Высокий load average сам по себе не равен высокому CPU utilization: в него могут входить процессы, ожидающие I/O.

### 5. Сравни временные ряды

Сопоставь на одном временном диапазоне:
- latency (p95/p99), error rate и throughput;
- CPU usage;
- throttled periods ratio и/или throttled time;
- node CPU utilization/pressure;
- изменение replicas, deployment rollout, requests/limits и трафика.

Сильное совпадение throttling с ростом latency поддерживает гипотезу, но не доказывает причинность автоматически. Если latency растёт без throttling и без node CPU saturation, переходи к другим гипотезам: I/O, DB, connection/thread pools, locks, GC, сетевые задержки.

## Как интерпретировать результаты

| Наблюдение | Возможная гипотеза | Что проверить дальше |
|---|---|---|
| Высокий throttling ratio, latency растёт | CPU limit слишком низкий или workload bursts | Тренды, лимит, профиль нагрузки, тест безопасного изменения |
| Throttling низкий, node CPU загружен | Node-level contention | CPU node, другие Pod, placement, capacity |
| CPU usage низкий, latency высокая | CPU может быть не bottleneck | DB, pools, locks, I/O, network, GC |
| Throttling высокий, но latency нормальная | Ограничение есть, но пока не доказан пользовательский impact | Throughput, latency, saturation, запас производительности |
| Несколько Pod на node деградируют одновременно | Общий ресурс или зависимость | Node pressure, shared dependency, сеть, storage |

## Что делать при подтверждённом throttling

Не убирай CPU limits автоматически и не увеличивай их вслепую.

1. Проверь, действительно ли throttling совпадает с пользовательской деградацией.
2. Убедись, что Node имеет capacity и увеличение limit не ухудшит соседние workloads.
3. Сопоставь CPU request с реальным профилем потребления: слишком низкий request может привести к неудачному placement и конкуренции.
4. Если изменение limit допустимо, делай его контролируемо, по согласованной процедуре, наблюдая latency, throughput, throttling и node metrics.
5. Проверь результат и зафиксируй baseline.

В production изменение ресурсов выполняй только через утверждённый процесс. Не удаляй limits как универсальный workaround.

## Связь с HPA

CPU utilization HPA рассчитывается относительно CPU request. Если request не задан или завышен/занижен, scaling behavior может быть неожиданным. Throttling — отдельный диагностический сигнал: HPA может не отражать полностью CPU saturation/latency, особенно если метрики, target и requests настроены неправильно.

См. [HPA](../15-hpa/README.md).

## Чего не следует путать

- **CPU usage** — сколько CPU-time потребляет workload в единицу времени.
- **CPU request** — значение, используемое scheduler для размещения Pod и базовое значение для CPU utilization HPA.
- **CPU limit** — квота CPU-time, которую cgroup ограничивает.
- **Throttling** — ограничение исполнения из-за исчерпания квоты.
- **Contention** — конкуренция за CPU, которая может возникнуть и без CPU limit.
- **Latency** — пользовательское время ответа; оно не обязано линейно коррелировать с CPU usage.

## Вопросы для самопроверки

- Почему CPU limit `500m` не означает, что Pod всегда использует ровно половину одного ядра?
- Как workload может иметь умеренный CPU usage и одновременно высокий throttling?
- Чем throttling отличается от node-level contention?
- Почему высокий throttling ratio не обязательно означает деградацию пользовательского опыта?
- Какие метрики нужно сопоставить, чтобы обосновать изменение CPU limit?
- Почему CPU request важен даже если у контейнера есть CPU limit?
- Почему нельзя бездумно удалить limits в production?

## Связанные материалы

- [Resources, QoS, OOMKilled и eviction](README.md)
- [HPA](../15-hpa/README.md)
- [Observability](../16-observability/README.md)
- [Manifests: Resources](../../Manifests/resources/README.md)
- [P0 fundamentals](../../labs/fundamentals-p0/README.md)
