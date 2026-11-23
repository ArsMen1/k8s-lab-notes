# Grafana triage: найти причину деградации по графикам

## Цель

Научиться использовать Grafana для расследования: выставлять time range, читать RED, сопоставлять с Kubernetes metrics, drill down по dimensions и отличать деградацию от проблем мониторинга.

**Tabletop exercise:** графики ниже условные. Не подключайся к production и не меняй ресурсы. Для hands-on нужна тестовая Grafana/Prometheus с datasource.

## Симптом и impact

В течение 20 минут пользователи сообщают, что API отвечает медленнее. Часть запросов завершается HTTP 5xx. Pods в Kubernetes Running, но это не подтверждает исправность сервиса.

Условные данные overview:
- request rate: примерно прежний;
- error rate: вырос с 0.3% до 6%;
- p50 latency: изменился незначительно;
- p95 latency: вырос с 250 ms до 2.8 s;
- CPU average workload: 45%;
- память без явного скачка;
- available replicas соответствует desired.

## Задания

### 1. Подготовь Grafana view
- Выбери datasource.
- Установи time range: 30 минут до и после начала проблемы.
- Проверь dashboard variables и выбери service/namespace.
- Найди panels для Rate, Errors, Duration и Kubernetes resources.

### 2. Определи impact
- Какие метрики изменились и насколько?
- Почему p50 и p95 ведут себя по-разному?
- Почему Running/Ready не исключает деградацию?
- Какой график первым подтверждает impact?

### 3. Сузь scope
- Что проверишь следующим: route, status code, pod, node, namespace или service?
- Если проблема только на одной replica, что проверять?
- Если p95 вырос у всех replicas, CPU/memory не изменились, какие гипотезы?

### 4. Проверка гипотез
Для каждой гипотезы выпиши confirming signal, falsifying signal и дополнительный evidence (logs, trace, events, deployment timeline). Рассмотри DB latency/connection pool saturation, downstream dependency, queue backlog, deploy/config regression, traffic shift и monitoring data gap.

### 5. Explore и качество данных
- Как исследовать p95 в Explore?
- Какие labels/filters выбрать?
- Как отличить No data от нуля?
- Что проверить при scrape gaps или Prometheus target DOWN?
- Почему dashboard не доказывает root cause?

### 6. Mitigation и verification
Не выбирай исправление без root cause. Опиши mitigation и его риски; какие графики сравнишь до/после; что считать восстановлением: impact, error rate, p95, traffic, replicas и alert state.

## Incident note

- **Impact:**
- **Timeline:**
- **Grafana evidence:**
- **Scope:**
- **Hypotheses:**
- **Confirmed root cause:**
- **Mitigation:**
- **Verification:**
- **Prevention:**

## Критерии успешного прохождения

- Не делаешь вывод по одной панели.
- Правильно выставляешь time range и scope.
- Отличаешь p50 от p95/p99, rate от errors.
- Проверяешь dimensions и baseline.
- Учитываешь datasource/scrape failure.
- Root cause подтверждаешь независимым evidence.
- Verification проверяет пользовательский impact, не только Pod state.
