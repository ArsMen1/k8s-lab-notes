# Kubernetes Observability: metrics, logs, traces и alerting

Observability — способность объяснять внутреннее состояние системы по внешним сигналам. Метрики показывают тренды и симптомы, логи — события и детали, traces — путь запроса через распределённые компоненты. Ни один сигнал сам по себе не доказывает root cause.

## RED и USE

RED для сервисов:
- Rate — запросы в секунду.
- Errors — число/доля ошибок.
- Duration — latency distribution, особенно p95/p99.

USE для ресурсов:
- Utilization — занятость ресурса.
- Saturation — очередь/ожидание/насыщение.
- Errors — ошибки ресурса.

Для Kubernetes дополнительно смотри Pod restarts, readiness, desired vs available replicas, pending pods, CPU throttling, memory working set, OOMKilled, Node conditions, PVC usage и HPA desired/current replicas.

## Prometheus, Grafana, Alertmanager

Prometheus собирает time series через scrape targets и exporters/instrumented apps. Kubernetes service discovery может находить Pods/Services, но scrape labels, relabeling и RBAC зависят от конфигурации. Grafana визуализирует источники данных, но сама метрики не собирает.

Alert rule должен иметь проверенное выражение, severity/owner, actionable summary, описание impact и ссылку на runbook. Используй разумный for, чтобы не реагировать на transient noise. Не алерти только на CPU 80% без связи с impact: комбинируй saturation с latency/errors.

## Logs и traces

Централизуй stdout/stderr и системные события; добавляй timestamp, severity, service, environment, trace/request ID. Не логируй токены, пароли, приватные ключи и персональные данные. kubectl logs не является долговременным архивом.

Distributed trace связывает spans между сервисами и показывает latency breakdown. Нужна instrumentation и propagation context (например, W3C Trace Context); без propagation trace может обрываться на границе сервиса.

## Incident workflow

1. Начни с user impact и временного окна.
2. Сопоставь RED на сервисе и USE на инфраструктуре.
3. Раздели симптомы по namespace/node/replica/zone.
4. Используй logs/events/traces для проверки гипотез.
5. Зафиксируй baseline до изменения.
6. После mitigation проверь customer impact, а не только Ready Pod.

Связано: [Production Support](../../labs/production-support/README.md), [P1 labs](../../labs/fundamentals-p1/README.md), [HPA](../15-hpa/README.md).
Проекты: [Prometheus](https://prometheus.io/docs/introduction/overview/), [Grafana](https://grafana.com/docs/grafana/latest/), [OpenTelemetry](https://opentelemetry.io/docs/).
