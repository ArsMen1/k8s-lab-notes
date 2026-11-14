# Observability stack: prerequisites and runbook

Prometheus/Grafana stack не vendored в репозитории: CRDs, values и совместимость зависят от Helm chart/operator и Kubernetes version. Не применяй случайные manifests из интернета к рабочему кластеру.

Для disposable кластера выбери и зафиксируй версию kube-prometheus-stack chart по официальной документации проекта. До установки проверь CRDs, namespace, Node capacity и совместимость версии. Helm install изменяет кластер и выполняется только в тестовой среде.

После установки проверь Prometheus targets/scrape errors, Grafana datasource, Alertmanager routes/receivers, exporters, retention/storage, RBAC и NetworkPolicy monitoring namespace.

Не коммить credentials, admin passwords, OAuth secrets и TLS private keys. Используй secret manager или локальный механизм учебного окружения.

    kubectl get pods,svc -n monitoring
    kubectl get servicemonitors,podmonitors -A
    kubectl get prometheusrules -A
    kubectl get events -n monitoring --sort-by=.metadata.creationTimestamp

Пример PrometheusRule находится в prometheus-rule-example.yaml. Он требует CRD PrometheusRule и Prometheus Operator; label release должен совпадать с ruleSelector установленного chart. Выражение up == 0 иллюстрирует scrape health, но не заменяет сервисные RED alerts. Официально: https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack
