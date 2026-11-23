# Grafana практикум: панели, PromQL и incident investigation

Практикум рассчитан на последовательное освоение Grafana с базовых действий до расследования инцидентов. Проходи упражнения на disposable-кластере или локальной тестовой среде. Никаких запросов/изменений в production без разрешения.

## Учебный маршрут

| Этап | Навык | Артефакт |
|---|---|---|
| 1 | UI orientation: datasource, dashboard, panel, time range, refresh | Умеешь объяснить интерфейс |
| 2 | Чтение готового dashboard | Incident snapshot |
| 3 | Explore + PromQL basics | Набор проверочных запросов |
| 4 | Panels: visualization, units, legends, thresholds | Dashboard draft |
| 5 | Variables и фильтры | Dashboard с namespace/service/pod |
| 6 | Correlation и drilldown | Timeline расследования |
| 7 | Alerting | Тестовый alert + verification |
| 8 | Dashboard troubleshooting | Incident report |
| 9 | Dashboard design и избегание misleading graphs | Review checklist |
| 10 | Итоговый практический инцидент | Полный incident report |

## Как учиться

- На каждом шаге сначала изучи терминологию и UI.
- Повтори операцию сам, затем объясни, зачем она нужна и какой вопрос отвечает.
- Не создавай панели ради количества: у каждой должен быть operational question.
- Для каждого query сформулируй ожидаемое значение/единицы и проверку качества данных.
- Не делай вывод из графика без независимого evidence.
- Заноси команды/запросы в заметки с объяснением, что они возвращают и как интерпретировать результат.

## Практические этапы

### 1. UI orientation
На тестовой Grafana найди datasource, dashboards, Explore, panel edit, time picker, refresh, variables, annotations, dashboard settings. Разбери, какие действия меняют только визуализацию, а какие могут влиять на datasource или конфигурацию. Не сохраняй изменения в общие dashboards без согласования.

**Контрольные вопросы**
- Где увидеть активный datasource и как отличить ошибку datasource от пустого результата?
- Где проверить time range, timezone и refresh?
- Что делает variable и как влияет на query?
- Что такое panel query, visualization, unit, legend, threshold?

### 2. Чтение готового dashboard
Выбери готовый dashboard, который отображает application RED и Kubernetes USE/ресурсные показатели. Для каждого графика запиши operational question, нормальное поведение, аномалию и следующий шаг. Найди rate, error rate, p50/p95/p99, CPU, throttling, memory, restarts, replicas, node pressure и dependency metrics, если они доступны.

**Задание:** зафиксируй baseline и короткий incident snapshot: время, scope, наблюдение, impact, следующие проверки.

### 3. Explore и PromQL
В Explore:
- выбери Prometheus datasource;
- начни с metric autocomplete и labels;
- добавь один filter за раз;
- сравни instant и range query;
- проверяй query result, legend, units, time range и resolution;
- сопоставляй aggregate series и per-instance breakdown.

**Упражнение:** исследуй метрики up, process_cpu_seconds_total (если присутствует), container_cpu_usage_seconds_total, container_memory_working_set_bytes, kube_pod_container_status_restarts_total, kube_deployment_status_replicas_available. Метрики зависят от scrape setup и exporter; сначала проверь наличие. Не копируй запросы с предположением, что все labels одинаковы в каждом окружении.

**Минимальные PromQL patterns (адаптируй labels под свой stack):**

    up
    sum(rate(container_cpu_usage_seconds_total[5m]))
    sum(container_memory_working_set_bytes)
    sum(rate(http_requests_total[5m]))
    sum(rate(http_requests_total{status=~"5.."}[5m]))
    histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

Это примеры, не гарантированно готовые запросы: metric names, labels, histogram buckets и доступность контейнерных метрик зависят от instrumentation/stack. Уточняй scope, exclusions, grouping и единицы. Aggregate CPU/memory query без фильтров может включать ненужные series или двойной счёт.

**Контрольные вопросы**
- Почему counters используют rate()?
- Чем instant query отличается от range query?
- Почему label filtering и grouping критичны?
- Почему aggregate query может скрыть один unhealthy Pod?
- Как распознать пустой результат и query error?

### 4. Создание panels
Создай panels в личном/test dashboard:
- Stat: current error rate или available replicas с понятной единицей;
- Time series: request rate и latency;
- Time series: CPU usage/throttling;
- Time series: memory working set и limit, если metric доступна;
- Table: breakdown по pod/instance.

Везде настрой meaningful title, unit, legend, description, threshold только когда threshold обоснован.
**Результат:** dashboard draft и список queries. Не публикуй и не меняй shared dashboard без approval.

### 5. Variables и фильтры
Создай variables для cluster, namespace, service/workload и pod, если labels доступны. Проверяй default selection и All-values, cascading dependencies, empty selection, фильтр который случайно ограничил данные, label cardinality — не создавай variables по высококардинальным/чувствительным labels без причины.

**Контрольный сценарий:** выбери namespace → workload → pod. Проверь, что каждый selection действительно ограничивает panel queries, а All не приводит к misleading aggregate.

### 6. Drill-down и корреляция
Проведи timeline: impact onset → alert → deploy/config change → metric change → mitigation → recovery. Сопоставь RED и USE; затем drill down service → route → pod → node. Проверяй logs, events, traces и dependency dashboards, если они подключены. Корреляция во времени не доказывает причинность.

### 7. Alerting (test-only)
В тестовой среде изучи alert rule: query, threshold/condition, evaluation interval, pending/for, firing, labels, annotations, contact point, notification policy и silences. Проверь test notification только на заранее согласованный безопасный receiver. Не создавай alert в production, не отключай реальный alert и не изменяй routing ради учебного упражнения.

**Verification:** alert state, evaluation history, receiver/test delivery и cleanup.

### 8. Dashboard review
- Dashboard отвечает на operational questions?
- Overview panels идут от impact к diagnostic detail?
- Units, titles, legends, descriptions понятны?
- Time range и refresh адекватны?
- Variables не скрывают series?
- Aggregation не маскирует replica?
- Thresholds основаны на SLO/baseline, а не произвольном цвете?
- Есть ссылки/drilldowns?
- Dashboard не перегружен, не содержит secrets/PII?
- Query load и cardinality разумны?

### 9. Итоговый incident simulation
Симптом: request rate стабилен, 5xx растут, p95 резко вырос, CPU не насыщен, все Pods Ready. На dashboard выбери time range, сравни baseline, разбей ошибки по endpoint/instance, изучи dependency latency/connection pool/queue, deployment annotations и monitoring health. Сформулируй несколько гипотез; для каждой назови evidence за и против. Root cause считается подтверждённым только после независимой проверки.

Заполни incident report:
- Impact / scope / start time
- Dashboard & time range / datasource
- RED evidence / Kubernetes evidence
- Breakdown (endpoint, pod, node)
- Hypotheses / evidence against
- Confirmed root cause
- Safe mitigation / risks
- Verification / recovery
- Prevention / follow-up

## Completion criteria

Ты готов двигаться дальше, когда можешь без подсказки:
1. выбрать правильный dashboard и datasource;
2. выставить time range, refresh и filters;
3. прочитать Rate → Errors → Duration и не путать averages с quantiles;
4. написать/адаптировать базовые PromQL queries в Explore;
5. создать и настроить test panels и variables;
6. провести drill-down и проверить monitoring-data quality;
7. безопасно проверить test alert;
8. оформить incident report с evidence и verification.

Практикум не означает, что весь stack автоматически установится: setup и version pinning остаются отдельным шагом.