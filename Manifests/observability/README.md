# Observability stack: prerequisites and runbook

Prometheus/Grafana stack не vendored в репозитории: CRDs, values и совместимость зависят от Helm chart/operator и Kubernetes version. Не применяй случайные manifests из интернета к рабочему кластеру.

Для disposable кластера выбери и зафиксируй версию kube-prometheus-stack chart по официальной документации проекта. Установи release в namespace `monitoring` (так настроены примеры ниже); если выбираешь другой namespace или release name, согласованно измени namespace и label `release` в тестовых ресурсах.

    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    helm search repo prometheus-community/kube-prometheus-stack --versions
    helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack --version <chart-version> --namespace monitoring --create-namespace --wait

До установки проверь CRDs, namespace, Node capacity и совместимость версии. Helm install/upgrade изменяет кластер и выполняется только в тестовой среде.

После установки проверь Prometheus targets/scrape errors, Grafana datasource, Alertmanager routes/receivers, exporters, retention/storage, RBAC и NetworkPolicy monitoring namespace.

Не коммить credentials, admin passwords, OAuth secrets и TLS private keys. Используй secret manager или локальный механизм учебного окружения.

    kubectl get pods,svc -n monitoring
    kubectl get servicemonitors,podmonitors -A
    kubectl get prometheusrules -A
    kubectl get events -n monitoring --sort-by=.metadata.creationTimestamp

Пример scrape-health rule находится в `prometheus-rule-example.yaml`. Он требует CRD PrometheusRule и Prometheus Operator; label `release` должен совпадать с ruleSelector установленного chart. Выражение `up == 0` иллюстрирует scrape health, но не заменяет сервисные RED alerts.

## Synthetic alert lab

После установки stack в disposable-кластере проверь CRD и Prometheus:

    kubectl config current-context
    kubectl get crd prometheusrules.monitoring.coreos.com
    kubectl get prometheus -A
    kubectl get prometheusrules -n monitoring

В `alert-lab.yaml` задан тестовый alert `K8sLabSyntheticAlert` с выражением `vector(1)`: он должен перейти в Firing примерно через минуту. Перед применением проверь namespace и измени label `release`, если он не совпадает с `spec.ruleSelector` твоего Prometheus.

    kubectl apply -f Manifests/observability/alert-lab.yaml
    kubectl get prometheusrules -n monitoring

Найди Prometheus Service через `kubectl get svc -n monitoring`, затем выполни `kubectl port-forward -n monitoring svc/<prometheus-service> 9090:9090` и проверь `http://localhost:9090/alerts` или запрос `ALERTS{alertname="K8sLabSyntheticAlert"}`. Если rule не появился, проверь CRD, `ruleSelector`, `ruleNamespaceSelector`, labels и логи Prometheus Operator. Alertmanager notification не гарантируется: route/receiver могут фильтровать severity warning, поэтому сначала проверь состояние rule в Prometheus.

После проверки удали только тестовый rule:

    kubectl delete -f Manifests/observability/alert-lab.yaml

Не применяй этот сценарий в production: правило намеренно постоянно firing, пока его не удалить.

Официально: https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack
