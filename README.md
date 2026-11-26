# K8s Lab Notes

Конспект Kubernetes и лаборатория диагностики. Теория объясняет устройство кластера, манифесты показывают декларативное состояние, а Labs учит расследовать неисправности по симптомам.

## С чего начать

1. [Проверка уровня](labs/00-level-check.md).
2. [Первая неделя инцидентов](labs/incidents.md) — сначала расследуй, затем открывай разборы в `labs/debrief/`.
3. [P0 Fundamentals](labs/fundamentals-p0/README.md) — Storage, StatefulSet, RBAC, QoS, DNS и NetworkPolicy.
4. [P1 labs](labs/fundamentals-p1/README.md) — Ingress/TLS, HPA и Observability.
5. [Identity & Access Management](Theory/17-identity-access/README.md) — LDAP, Active Directory, OIDC, Dex, Keycloak и Kubernetes RBAC.
6. [Production Support практикум](labs/production-support/README.md) — диагностика типовых инцидентов.
7. [Отдельные troubleshooting labs](labs/troubleshooting/README.md) — Node NotReady, DiskPressure, FailedMount, ImagePullBackOff.
8. [Лаборатория Identity & Access](labs/identity-access/README.md) — 401, 403, LDAP и OIDC troubleshooting.
9. [Основной маршрут обучения](Theory/00-overview/learning-path.md).
10. Если интересует конкретная тема — смотри [карту теории](Theory/README.md).

## Структура

- `Theory/00-overview/` — основы, карта обучения и открытые вопросы.
- `Theory/01-workloads/` — Pod, Deployment, DaemonSet, probes и rollout.
- `Theory/02-networking/` — Service, EndpointSlice, Ingress, API groups.
- `Theory/03-scheduling/` — scheduler, taints, tolerations и affinity.
- `Theory/04-config/` — ConfigMap, Secret, 12-factor и Spring Config.
- `Theory/05-operations/` — kubectl, диагностика и порядок применения манифестов.
- `Theory/06-organization/` — Namespace, labels, selectors и annotations.
- `Theory/07-crd/` — CRD, Custom Resources, schema, versioning, controllers и operators.
- `Theory/08-cluster-admin/` — kubeadm, архитектура кластеров и обновления.
- `Theory/09-storage/` … `14-networkpolicy/` — Storage, StatefulSet, RBAC, QoS, DNS/CoreDNS и NetworkPolicy.
- `Theory/15-hpa/` и `16-observability/` — autoscaling и мониторинг.
- `Theory/17-identity-access/` — LDAP, Active Directory, OIDC, Dex, Keycloak и интеграция с Kubernetes.
- `Manifests/` — учебные рабочие и намеренно сломанные Kubernetes-манифесты.
- `labs/` — проверка знаний, сценарии инцидентов, разборы и Production Support runbooks.

## Локальная лаборатория (kind + Terraform / Pulumi)

Для практики можно быстро поднять локальный Kubernetes-кластер с помощью [инструкции по запуску](setup/README.md). Доступны два альтернативных инструмента Infrastructure as Code: [Terraform](setup/terraform/README.md) и [Pulumi](setup/pulumi/README.md). Выбирай один — оба создают локальный kind-кластер, используют отдельный kubeconfig и не разворачивают учебные приложения автоматически.

Если не знаешь, с чего начать, смотри [сравнение Terraform и Pulumi](setup/terraform-vs-pulumi.md) — там объясняются различия и рекомендованный маршрут обучения.

## Ручное развёртывание манифестов в учебном кластере

Команды ниже предназначены для Killercoda, minikube, kind или другого выделенного учебного кластера. Не выполняй их в production или shared-кластере без отдельного согласования.

```bash
git clone https://github.com/ArsMen1/k8s-lab-notes.git
cd k8s-lab-notes

kubectl apply -f Manifests/payments-api/namespace.yaml
kubectl apply -f Manifests/payments-api/configmap.yaml
kubectl apply -f Manifests/payments-api/secret.yaml
kubectl apply -f Manifests/payments-api/service.yaml
kubectl apply -f Manifests/payments-api/deployment.yaml

kubectl apply -f Manifests/config-server/namespace.yaml
kubectl apply -f Manifests/config-server/
kubectl apply -f Manifests/echo/namespace.yaml
kubectl apply -f Manifests/echo/

kubectl -n payments get deploy,rs,pods,svc
```

Не применяй `Manifests/` целиком: внутри есть намеренно сломанные сценарии и отдельные лаборатории CRD. Для каталогов приложений сначала создавай namespace отдельным файлом, затем применяй namespaced-ресурсы; порядок файлов при `kubectl apply -f <directory>/` не следует считать зависимостно-безопасным. Для `payments-api` намеренно перечислены отдельные файлы, чтобы не создавать необязательный NodePort автоматически. Соблюдай README конкретного упражнения.

Снаружи учебный NodePort создаётся отдельно и только если он действительно нужен:

```bash
kubectl apply -f Manifests/payments-api/service-nodeport.yaml
```

Порт 30080. NodePort открывает порт на адресах Node в пределах сетевой доступности кластера; это учебный способ доступа, а не универсальная рекомендация для production. Перед применением проверь, что порт свободен и кластер изолирован.

## Правила репозитория

1. Одна тема — одна заметка; связи между заметками оформляй wiki-ссылками.
2. В конце практической заметки фиксируй, что именно увидел в кластере.
3. В git храни манифесты и безопасные примеры. Не коммить реальные пароли, kubeconfig, приватные ключи и дампы.
4. Перед применением незнакомого каталога сначала читай README конкретного упражнения.
