# Grafana для Production Support: как читать дашборды и расследовать инциденты

Grafana — рабочее место для анализа метрик, логов и других источников данных. Она не собирает метрики сама: часто отображает Prometheus, Loki, Elasticsearch и другие источники.

Цель инженера поддержки — не «найти красный график», а ответить: что ухудшилось и кого затронуло; когда началось; это приложение, инфраструктура, зависимость или мониторинг; какой следующий разрез проверит гипотезу?

## 1. Не начинай с поиска виноватого

1. **Impact:** пользователь видит ошибки, медленные ответы, недоступность или частичную деградацию?
2. **Временное окно:** когда началось и закончилось, есть ли известное время изменения?
3. **Baseline:** как метрика выглядела до инцидента? Сравни с обычным периодом.
4. **Scope:** все сервисы, один service, replica, node, namespace, zone или endpoint?

График без временного окна и контекста почти ничего не доказывает.


## 2. Ориентация в Grafana

### Dashboard

Dashboard — набор panels для наблюдения за системой. Ключевые элементы:
- **Time range** — диапазон в правом верхнем углу: Last 15 minutes, Last 1 hour или custom interval.
- **Refresh** — автообновление. Не выбирай слишком частое без причины.
- **Variables** — фильтры cluster, namespace, service, pod. Проверь scope, чтобы не смотреть чужой workload или случайно агрегировать все.
- **Panels** — графики, stat, table, heatmap и др. Читай title, units, description и legend.
- **Legend** — series и значения. Исчезнувшая линия не обязательно означает ноль.
- **Annotations** — deploy, config change, incident marks. Сопоставляй с началом симптома.
- **Links/drilldown** — переход к подробному dashboard или Explore, если настроено.

### Explore

Explore — самостоятельные запросы к datasource без редактирования dashboard. Используй, когда панель показала аномалию и нужно уточнить query; сравнить service/pod/namespace; добавить фильтры; или проверить, есть ли данные вообще.

Проверяй datasource, query, labels/filters и time range. В Prometheus часто используется PromQL. Сам факт отображения графика не гарантирует корректность запроса.

### Не обманись графиком

- **No data ≠ 0.** Возможны scrape failure, фильтр, отсутствующая series или datasource error.
- **Instant value ≠ история.** Stat показывает текущее значение, но не trend.
- **Среднее ≠ распределение.** Средняя latency может быть нормальной при плохом p95/p99.
- **Общий график скрывает instance.** Разбей по pod/node/instance.
- **Autoscale осей.** Y-axis может визуально усилить или ослабить колебания.
- **Агрегация по времени.** Большой time range сглаживает короткие пики.

## 3. В каком порядке смотреть графики: RED

Для пользовательского сервиса начни с RED:

| Сигнал | Что смотреть | Что понять |
|---|---|---|
| Rate | Requests/sec, throughput | Изменился ли входящий трафик |
| Errors | Error rate, HTTP 5xx; ожидаемые 4xx отдельно | Появились ли ошибки и их impact |
| Duration | p50/p95/p99 latency | Как быстро отвечают; есть ли latency tail |

Практический порядок:
1. **Rate:** упал ли трафик? Падение может быть routing/availability issue, а не улучшением производительности.
2. **Errors:** выросли ли ошибки одновременно с latency/rate? Раздели по типам.
3. **Duration:** сравни p50 с p95/p99. Если p50 стабилен, а p99 растёт, страдает часть запросов или есть очереди/зависимости.
4. Разбивай по service, route, status code, instance, zone.
5. Сравни с deployment, config, traffic, feature flag, зависимостями.

## 4. Kubernetes: что смотреть

| Панель | Что искать | Ограничение |
|---|---|---|
| Request rate | Рост/падение трафика | Сравни baseline и время суток |
| Error rate | Доля ошибочных запросов | Не только абсолютное число |
| p95/p99 latency | Пользовательская задержка | Уточни units и histogram correctness |
| CPU usage | CPU нагрузка | Высокий CPU не всегда impact |
| CPU throttling | Контейнер ограничивается quota | Смотри вместе с latency/usage |
| Memory working set | Рост, plateau, spikes | Учитывай тип метрики и limit |
| Restarts / OOM | Перезапуски, OOMKilled | Различай единичный и массовый pattern |
| Replicas | desired/current/available | Новые replicas должны быть Ready и полезны |
| Pending / Node pressure | Scheduling/capacity проблемы | Сверяй Events |
| Network | Throughput, drops, errors | Доступность метрик зависит от CNI/node exporter |
| Dependencies | DB pool/latency, queue lag, downstream errors | Kubernetes может быть здоров, зависимость — нет |

## 5. Pattern → hypothesis → check

| Наблюдение | Возможная гипотеза | Следующая проверка |
|---|---|---|
| p95 растёт, rate стабилен, CPU не насыщен | зависимость, lock/queue, GC, I/O | DB/downstream latency, logs, traces, saturation |
| Errors выросли после deploy | regression/config | annotation, версия, logs, сравнить replicas |
| CPU и latency растут | saturation/throttling | usage, throttling, per-pod, requests/limits |
| Memory steadily растёт | leak/cache/рост данных | working set, heap/GC, restart history |
| Rate резко падает, errors не растут | routing/upstream/client/metric gap | ingress, upstream, scrape health, targets |
| Только одна replica хуже | instance/node issue | per-pod, node, restart, logs |
| Все replicas хуже | shared dependency/config/traffic | DB, downstream, deploy, shared infra |
| No data | query/label/time/datasource/scrape | Explore, query, targets, datasource health |

Patterns дают гипотезу, не root cause.

## 6. Time range — ключевой навык

- **Last 5–15 minutes:** что происходит сейчас?
- **Last 1 hour:** развитие инцидента и момент начала.
- **Last 6–24 hours:** начало отклонения, цикличность.
- **Last 7 days:** baseline и повторяемость.
- **Custom range:** сравнение с точным временем deploy/incident.

При инциденте: выбери широкий диапазон, найди момент изменения, постепенно сузь для деталей, затем вернись к широкому окну и сравни baseline. Используй time shift, если он поддерживается dashboard.

## 7. Dimensions / labels

Меняй разрезы по одному: cluster → namespace → service/workload → pod/instance; route/endpoint; status code/error type; node/zone; app version/release.
Если деградация на одном Pod, это сужает investigation, но не доказывает причину. Сверь node, restart, deployment, logs и нагрузку.

## 8. Incident workflow

1. Запиши impact и время начала.
2. Выставь правильный time range, datasource и filters.
3. Посмотри Rate → Errors → Duration.
4. Сравни с CPU, throttling, memory, replicas и Node health.
5. Найди первое отклонение, а не только самый большой пик.
6. Разбей по service/pod/route/node.
7. Сопоставь с deployment/config/traffic/alert timeline.
8. Сформулируй 2–3 гипотезы и evidence для подтверждения/опровержения.
9. Используй Explore, если dashboard недостаточно подробен.
10. Подтверди root cause независимым сигналом: logs, events, traces или system state.
11. После mitigation сравни те же графики: impact вернулся? metrics близки к baseline?
12. Запиши evidence, root cause, mitigation, validation и prevention.

## 9. Dashboard checklist

- [ ] Правильный datasource?
- [ ] Правильные cluster/namespace/service filters?
- [ ] Time range охватывает инцидент?
- [ ] Refresh актуален?
- [ ] Units понятны?
- [ ] Query и aggregation подходят вопросу?
- [ ] Missing data / scrape gaps исключены?
- [ ] Aggregation не скрывает unhealthy instance?
- [ ] Сравнил с baseline?
- [ ] Есть независимый сигнал подтверждения?

## 10. Связанные материалы

- [Observability overview](README.md)
- [Prometheus & stack runbook](../../Manifests/observability/README.md)
- [Troubleshooting labs](../../labs/troubleshooting/README.md)
- [Grafana official documentation](https://grafana.com/docs/grafana/latest/)
