# Manifests

Здесь желаемое состояние. В каталогах приложений один объект обычно вынесен в отдельный файл; файлы инцидентов могут содержать несколько YAML-документов через ---.

`kubectl apply -f Manifests/` целиком не запускай: подхватится `incidents/` и учебный кластер сломается по сценарию.

## Приложения

| Каталог | Что это |
|---------|---------|
| `payments-api/` | рабочий сервис: Namespace, ConfigMap, Secret, Deployment, Service; отдельный необязательный NodePort |
| `config-server/` | Spring Cloud Config Server и его ClusterIP |
| `echo/` | крошечный сервис в namespace `lab`, чтобы потрогать DNS между namespace |

Перед применением сначала создай namespace отдельной командой. `kubectl apply -f <каталог>/` не гарантирует, что Namespace будет обработан раньше остальных файлов: например, `configmap.yaml` сортируется раньше `namespace.yaml`.

Для базового `payments-api` перечисляй файлы явно: так необязательный `service-nodeport.yaml` не будет создан вместе с остальными ресурсами.

```bash
kubectl apply -f Manifests/payments-api/namespace.yaml
kubectl apply -f Manifests/payments-api/configmap.yaml
kubectl apply -f Manifests/payments-api/secret.yaml
kubectl apply -f Manifests/payments-api/service.yaml
kubectl apply -f Manifests/payments-api/deployment.yaml

kubectl apply -f Manifests/config-server/namespace.yaml
kubectl apply -f Manifests/config-server/

kubectl apply -f Manifests/echo/namespace.yaml
kubectl apply -f Manifests/echo/
```

Повторное применение `namespace.yaml` внутри каталога безопасно для этого примера, поскольку оно декларативно задаёт тот же объект. Для собственных каталогов сохраняй явный bootstrap namespace перед namespaced-ресурсами.

`payments-api/service-nodeport.yaml` — необязательный Service для доступа через NodePort в изолированном учебном кластере без Ingress. Применяй его отдельно, только если он нужен и порт свободен:

```bash
kubectl apply -f Manifests/payments-api/service-nodeport.yaml
```

NodePort открывает порт на адресах Node в пределах сетевой доступности кластера. В production снаружи обычно используют Ingress/Gateway или облачный LoadBalancer в соответствии с архитектурой.

Секрет в git — учебная заглушка. Настоящие пароли сюда не кладут.

## Дополнительные учебные стенды

| Каталог | Назначение | Требование |
|---|---|---|
| storage/ | PVC и volume mount | Подходящий StorageClass/CSI |
| statefulset/ | Headless Service, StatefulSet, PVC per ordinal | StorageClass |
| rbac/ | ServiceAccount, Role, RoleBinding | Impersonation rights для проверки |
| resources/ | requests/limits и QoS | Не запускать искусственную OOM на shared nodes |
| networkpolicy/ | default-deny и allow rules | CNI с NetworkPolicy enforcement и CoreDNS selector |
| ingress/ | backend, Ingress и TLS | Ingress Controller и IngressClass |
| hpa/ | autoscaling/v2 | metrics-server/API resource metrics |
| observability/ | Prometheus/Grafana runbook | Stack зависит от chart/operator и версии |

Не применяй все каталоги разом. Следуй README конкретной лаборатории.

## Инциденты

`incidents/01.yaml` … `07.yaml` специально сломаны. Это задания из [`labs/incidents.md`](../labs/incidents.md). Применяй только тот номер, до которого дошёл в истории.
