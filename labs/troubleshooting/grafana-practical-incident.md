# Grafana practical incident: dashboard, Explore, PromQL, panels, variables и alerting

## Задача

Это практический walkthrough для самостоятельной работы в Grafana на тестовом окружении. Учебная цель — пройти интерфейсные действия, Explore/PromQL, построение panels, variables и alerting, а затем провести incident investigation. Никаких изменений production.

## Предусловия

- Тестовая Grafana, Prometheus datasource и разрешённый test receiver для alert notification.
- Метрики приложения и Kubernetes metrics присутствуют; их имена/labels могут отличаться.
- Сначала убедись, что это тестовая среда, а не shared/production instance.

## Part 1 — UI walkthrough

В Grafana изучи:
- datasource settings/list — идентификатор Prometheus datasource, его health;
- dashboards — открыть dashboard и просмотреть panels;
- time picker — выбрать Last 15 minutes, Last 1 hour и custom range;
- refresh — ручной refresh и auto refresh interval;
- variables — посмотреть dropdown и query, как selection влияет на panels;
- Explore — выбрать datasource и исследовать query;
- panel edit — посмотреть query, visualization, units, legend, thresholds, description;
- annotations — deployment/change timeline, если datasource annotations подключены.

Не меняй общие dashboards или datasource settings. Для редактирования используй личный/test dashboard.

## Part 2 — Read existing dashboard

Открой dashboard с приложением. Заполни для каждой panel:

| Panel | Вопрос, на который отвечает | Normal baseline | Incident pattern | Следующая проверка |
|---|---|---|---|---|
| Request rate | Какой traffic? | | | |
| Error rate | Сколько requests неуспешны? | | | |
| Latency p50/p95/p99 | Как быстро отвечает сервис? | | | |
| CPU usage/throttling | Есть ли CPU bottleneck? | | | |
| Memory | Рост/limit/working set? | | | |
| Restarts/replicas | Стабильны ли instances? | | | |
| Dependency/queue | Не тормозит ли downstream? | | | |

Проверь scope, units, legend, time range и datasource. Не принимай вывод по одной panel.

## Part 3 — Explore: PromQL warm-up

В Explore выбери Prometheus datasource. Начни с metric autocomplete, проверяй наличие series и labels в своём окружении. Выполни queries по одному, уточняя filters:

    up
    sum(rate(container_cpu_usage_seconds_total[5m]))
    sum(container_memory_working_set_bytes)
    sum(rate(http_requests_total[5m]))
    sum(rate(http_requests_total{status=~"5.."}[5m]))
    histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

Это примеры, не гарантированно готовые запросы: metric names, labels, histogram buckets и доступность контейнерных метрик зависят от instrumentation/stack. Уточняй scope, exclusions, grouping и единицы. Aggregate query без фильтров может включать ненужные series или двойной счёт.

### Questions

- Чем counter отличается от gauge?
- Почему для counter нужен rate?
- Instant vs range query — в чём разница?
- Как фильтровать по labels?
- Как aggregate query может скрыть отдельный unhealthy Pod?
- Как определить query error, empty result и zero?

## Part 4 — Build personal/test dashboard

Создай новый dashboard в личном/test folder. Не сохраняй правки в shared dashboard без согласования.

Построй panels:
1. Stat — current error rate с unit и описанием.
2. Time series — request rate.
3. Time series — latency p50/p95/p99, если instrumentation поддерживает quantiles/histograms.
4. Time series — CPU usage/throttling.
5. Time series — memory working set и limit.
6. Table — per-pod breakdown.

Для каждой panel настрой meaningful title, unit, legend, description и thresholds, если они обоснованы. Проверь time range, tooltip и отсутствие misleading aggregation.

## Part 5 — Dashboard variables

Создай variables по доступным labels, например cluster, namespace, workload/service и pod. Проверь:
- default selection и All;
- cascading variables;
- пустой выбор;
- query filtering, действительно ли panel реагирует на selection;
- labels с высокой cardinality и sensitive values — избегай их без нужды.

Контроль: выбери namespace, затем service/workload, затем pod. Убедись, что graph scope реально изменяется.

## Part 6 — Drill-down & correlation

Составь incident timeline: symptom onset; alert timestamp; deployment/config change; traffic change; mitigation; recovery.

Разбивай metrics по endpoint/status code/instance. Сравни service-level RED с pod-level и node-level metrics. Если datasource подключены, сопоставь logs, trace IDs, Events и dependency dashboard. Корреляция не равна причинности.

## Part 7 — Test alerting

Только в тестовой Grafana и только с безопасным receiver:
- посмотри query/condition;
- evaluation interval;
- pending/for duration;
- firing/resolved states;
- labels и annotations;
- contact point и notification policy;
- test delivery и cleanup.

Не отключай реальные alerts, не меняй production routing, не создавай test alert на боевом datasource.

## Part 8 — Incident scenario

Симптом: request rate стабильный, 5xx растут, p95 резко увеличился, CPU не насыщен, все Pods Ready.

1. Выбери time range, который показывает baseline и начало деградации.
2. Сравни Rate → Errors → Duration.
3. Раздели errors по endpoint/status code и latency по instance.
4. Сравни replicas, restarts, CPU/throttling, memory.
5. Проверь dependency latency, connection pool и queue backlog, если эти metrics доступны.
6. Сопоставь с deployment/config annotations.
7. Проверь monitoring data health.
8. Для каждой гипотезы запиши supporting и contradictory evidence.
9. Root cause подтвердить независимым сигналом; не считать график достаточным доказательством.

## Incident report

- **Impact / scope:**
- **Start time / timeline:**
- **Datasource / dashboard / time range:**
- **RED evidence:**
- **Kubernetes evidence:**
- **Breakdown (endpoint, pod, node):**
- **Hypotheses + evidence against:**
- **Confirmed root cause:**
- **Safe mitigation / risks:**
- **Verification / recovery:**
- **Prevention:**

## Критерии завершения

- Самостоятельно находишь dashboard и datasource.
- Меняешь time range, refresh и variables без потери контекста.
- Читаешь RED и отличаешь p50/p95/p99.
- Выполняешь и адаптируешь базовые PromQL queries.
- Создаёшь panels и variables на личном dashboard.
- Проверяешь monitoring health, drill-down и независимое evidence.
- Понимаешь alert lifecycle и тестируешь безопасно.
- Заполняешь incident report.