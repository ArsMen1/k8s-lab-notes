# K8s Lab Notes

Конспект Kubernetes и лаборатория диагностики. Теория объясняет устройство кластера, манифесты показывают декларативное состояние, а Labs учит расследовать неисправности по симптомам.

## С чего начать

1. [Проверка уровня](labs/00-level-check.md).
2. [Первая неделя инцидентов](labs/incidents.md) — сначала расследуй, затем открывай разборы в `labs/debrief/`.
3. [P0 Fundamentals](labs/fundamentals-p0/README.md) — Storage, StatefulSet, RBAC, QoS, DNS и NetworkPolicy.
4. [P1 labs](labs/fundamentals-p1/README.md) — Ingress/TLS, HPA и Observability.
5. [Production Support практикум](labs/production-support/README.md) — диагностика типовых инцидентов.
6. [Основной маршрут обучения](Theory/00-overview/learning-path.md).
7. Если интересует конкретная тема — смотри [карту теории](Theory/README.md).

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
- `Manifests/` — учебные рабочие и намеренно сломанные Kubernetes-манифесты.
- `labs/` — проверка знаний, сценарии инцидентов, разборы и Production Support runbooks.

## Быстрый старт

Нужен учебный кластер: Killercoda, minikube или kind.

```bash
git clone https://github.com/ArsMen1/k8s-lab-notes.git
cd k8s-lab-notes

kubectl apply -f Manifests/payments-api/namespace.yaml
kubectl apply -f Manifests/payments-api/
kubectl apply -f Manifests/config-server/namespace.yaml
kubectl apply -f Manifests/config-server/
kubectl apply -f Manifests/echo/namespace.yaml
kubectl apply -f Manifests/echo/

kubectl -n payments get deploy,rs,pods,svc
```

Не применяй `Manifests/` целиком: внутри есть намеренно сломанные сценарии и отдельные лаборатории CRD. Для каталогов приложений сначала создавай namespace отдельным файлом, затем применяй каталог; порядок файлов при `kubectl apply -f <directory>/` не следует считать зависимостно-безопасным. Соблюдай README конкретного упражнения.

Снаружи учебный NodePort:

```bash
kubectl apply -f Manifests/payments-api/service-nodeport.yaml
```

Порт 30080. Это учебный способ доступа, а не универсальная рекомендация для production.

## Правила репозитория

1. Одна тема — одна заметка; связи между заметками оформляй wiki-ссылками.
2. В конце практической заметки фиксируй, что именно увидел в кластере.
3. В git храни манифесты и безопасные примеры. Не коммить реальные пароли, kubeconfig, приватные ключи и дампы.
4. Перед применением незнакомого каталога сначала читай его README.
