# Порядок применения Kubernetes-манифестов

## Короткий ответ

**Порядок создания Service и Deployment обычно не важен для selector-based discovery. Порядок создания всех Kubernetes-ресурсов — не универсально не важен.**

Kubernetes контроллеры приводят фактическое состояние к желаемому, но API Server не превращает набор манифестов в транзакцию и не ждёт автоматически готовности всех зависимостей.

## 1. Service и Deployment

Оба варианта обычно работают:

1. Сначала Deployment: Pod создаются, затем Service начинает находить подходящие Pod по selector.
2. Сначала Service: у него временно нет ready endpoints; после создания и готовности Pod EndpointSlice-контроллер обновляет EndpointSlice.

Проверяй selector, labels и готовность Pod:

    kubectl get svc <service> -n <namespace> -o yaml
    kubectl get pods -n <namespace> --show-labels
    kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service>

Service discovery — асинхронная работа контроллеров. Сам факт существования Service не означает, что у него уже есть готовые endpoints.

## 2. Реальные зависимости

Учитывай зависимости, которые должны существовать до запуска workload:

- **Namespace** должен существовать до создания namespaced resources. Если namespace отсутствует, API Server отклонит запрос.
- **CRD** нужно зарегистрировать и дождаться condition Established до создания Custom Resources этого типа.
- **Secret/ConfigMap** должны существовать до старта контейнера, который ссылается на обязательный Secret/ConfigMap key. Иначе Pod может получить CreateContainerConfigError/FailedMount и повторять попытки.
- **PVC** должен быть создан, но его binding/provisioning может происходить асинхронно; Pod может ждать storage.
- **ServiceAccount/RBAC** должны быть согласованы с workload до того, как приложение начнёт выполнять запросы к API.

Не считай, что контроллеры «угадают» нужный порядок. Некоторые ошибки будут повторно обработаны автоматически, но это не заменяет readiness checks и корректный deployment workflow.

## 3. Каталоги и multi-document YAML

- При kubectl apply -f <directory>/ не полагайся на порядок файлов в каталоге: CLI обрабатывает найденные файлы, но это не dependency-aware orchestrator.
- В одном YAML-файле можно разместить несколько объектов через разделитель ---. Они обрабатываются последовательно в порядке документов.
- Явно разделяй bootstrap-ресурсы и workload. Например:

    kubectl apply -f namespace.yaml
    kubectl apply -f configmap.yaml
    kubectl apply -f secret.yaml
    kubectl apply -f deployment.yaml
    kubectl rollout status deployment/<name> -n <namespace>

- Для CRD сначала примени CRD, дождись Established, затем создавай CR.

Для учебных каталогов этого репозитория сначала применяй namespace-файл отдельно — см. [Manifests README](../../Manifests/README.md).

## 4. Переменные окружения Service и DNS

Если Service существует в момент создания Pod и включён enableServiceLinks, kubelet может добавить legacy service environment variables. Уже запущенный Pod не получает такие переменные задним числом, если Service создан позже.

Не используй эти переменные как основной способ service discovery. Предпочитай DNS-имена Service и явную конфигурацию приложения. DNS-запросы разрешаются независимо от того, был ли Service создан раньше Pod.

## 5. GitOps

Argo CD, Flux и другие инструменты синхронизации не отменяют зависимости. Они могут предоставлять sync waves, health checks и отдельные стадии для CRD/CR, но эти механизмы нужно явно настроить. Проверяй не только факт применения YAML, но и readiness/health зависимых ресурсов.

## Связанные заметки

- [[where-are-endpoints-stored]]
- [[service-types]]
- [[api-groups]]
- [CRD lab](../../Manifests/crd/README.md)
