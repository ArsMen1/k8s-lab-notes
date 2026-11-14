# P1 labs: Ingress/TLS, HPA и Observability

Выполняй только в disposable кластере. Сначала проверь context и прочитай README соответствующего каталога.

## Lab 1 — Ingress 404/502/TLS

Подготовка: [Ingress theory](../../Theory/02-networking/ingress-and-loadbalancer.md), [Ingress manifests](../../Manifests/ingress/README.md).

Требования: установленный Ingress Controller, существующий IngressClass и доступный адрес controller. Контроллер зависит от дистрибутива и инфраструктуры; этот репозиторий не устанавливает controller автоматически.

Диагностика:

    kubectl get ingressclass
    kubectl get ingress -A -o wide
    kubectl describe ingress web -n lab-p1
    kubectl get svc,endpointslices -n lab-p1
    kubectl get pods -A | grep -i ingress

404: Host/path/class/controller rules. 502/503: backend Service/port, ready endpoints, app listen port и controller logs. TLS error: Secret namespace/type, SAN, expiry и certificate-key pair.

Безопасное исправление: исправь host/path/backend/class или пересоздай только тестовый TLS Secret. Не отключай TLS verification как production workaround.

Проверка: HTTPS запрос с правильным Host достигает backend, сертификат соответствует имени.

## Lab 2 — HPA не масштабируется

Подготовка: [HPA theory](../../Theory/15-hpa/README.md), [manifests](../../Manifests/hpa/README.md).

Симптом: HPA показывает Unknown/FailedGetResourceMetric либо replicas не меняются.

Диагностика:

    kubectl get hpa web -n lab-p1
    kubectl describe hpa web -n lab-p1
    kubectl top pods -n lab-p1
    kubectl get apiservices | grep metrics
    kubectl get deployment web -n lab-p1 -o yaml

Проверь metrics-server, CPU requests, selector, targetRef, readiness и наличие метрик.

Безопасное исправление: восстанови metrics pipeline или исправь HPA target/requests в тестовом namespace. Нагрузку генерируй только в disposable кластере.

Проверка: HPA получает метрики, desired replicas меняются в пределах min/max и стабилизируются.

## Lab 3 — Observability alert triage

Подготовка: [Observability theory](../../Theory/16-observability/README.md), [stack runbook](../../Manifests/observability/README.md).

Симптом: alert о росте latency/errors либо saturation.

Диагностика: выбери временное окно, сравни RED (rate/errors/duration) с USE (utilization/saturation/errors), проверь Prometheus target health, scrape gaps, dashboard time range, logs и trace IDs.

Root cause нельзя выводить из одного графика. Раздели impact по service/namespace/node/zone, сопоставь с change timeline и подтверди гипотезу независимым сигналом.

Безопасное исправление: mitigation должно соответствовать подтверждённой причине. Не отключай alert и не меняй threshold только ради зелёного статуса.

Проверка: customer impact восстановлен, метрики вернулись к baseline, alert resolved и причина/предотвращение задокументированы.

Для каждого сценария заполни symptom, impact, timeline, evidence, hypotheses, root cause, mitigation, validation и prevention.
