# Вопросы для исследования

## Следующие темы

- Как диагностировать ImagePullBackOff и проверить доступ к registry, image tag и imagePullSecrets?
- Как отличить отказ Readiness Probe от Liveness Probe и как исправить их без лишних рестартов?
- Почему Pod остаётся в Pending и как различать нехватку ресурсов, taints/tolerations и scheduling constraints?
- Как безопасно диагностировать OOMKilled, memory pressure и CPU throttling?
- Как расследовать FailedMount, CSI-ошибки и проблемы с доступом к persistent storage?
- Как диагностировать NodeNotReady, DiskPressure и другие проблемы состояния ноды?
- Как расследовать сбои CoreDNS и отличать DNS-проблему от сетевой или прикладной?
- Как NetworkPolicy может блокировать трафик между Pod и как безопасно проверить её влияние?
- Как расследовать Ingress 404/502/503, TLS-ошибки и проблемы связи Ingress → Service → endpoints?
- Почему HPA не масштабирует workload и как проверять Metrics API, requests и поведение autoscaling?
- Как диагностировать высокую latency, отделяя CPU, память, сеть и сбои зависимостей?
- Как безопасно расследовать неудачный Deployment rollout и выполнять rollback?
- Как расследовать ситуацию, когда Deployment/rollout прошёл успешно, Pod Ready и Service имеет endpoints, но приложение сломано (5xx, timeout или неверная бизнес-функция)?
- Как проверять RBAC-ошибки Forbidden через субъект, verb, resource и kubectl auth can-i?
- Как расследовать исчерпание connection pool или отказ внешней зависимости, когда Kubernetes-компоненты выглядят исправными?
- Как собирать Logs, Metrics и Events в единое расследование и определять первопричину, а не только симптомы?
- Как ориентироваться в Grafana: datasource, dashboard, panels, time range, refresh и variables?
- Как использовать Explore и PromQL для проверки метрик, labels, rate и histogram quantiles?
- Как читать Rate, Errors и Duration, сравнивать p50/p95/p99 и отличать impact от шума?
- Как создать корректные panels (units, legends, thresholds) и dashboard variables?
- Как делать drill-down по service, endpoint, pod и node и коррелировать метрики с deploy/config changes, logs и traces?
- Как отличать No data от нулевого значения и расследовать scrape/datasource failure?
- Как устроены alert rules, pending/firing, contact points и notification policies, и как безопасно тестировать alert?
- Как оформлять incident report по схеме Symptoms → Root Cause → Resolution → Prevention?

## Дополнительные вопросы

- Как работает LoadBalancer в bare-metal кластере и когда нужен MetalLB?
- Что такое Ingress Controller и чем он отличается от Ingress? Где здесь Gateway API и service mesh?
- Как Kubernetes решает, на какую Node ставить Pod? Как взаимодействуют Scheduler, Affinity, Taints и topology spread?
- Как работает NetworkPolicy, если CNI (например, Flannel) её не поддерживает?
- Как обновлять StatefulSet без простоя, например при работе с базой данных?
- Как обновлять БД без простоя, если она работает вне Kubernetes, например в Docker?
