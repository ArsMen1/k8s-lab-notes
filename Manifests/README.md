# Manifests

Здесь желаемое состояние. В каталогах приложений один объект обычно вынесен в отдельный файл; файлы инцидентов могут содержать несколько YAML-документов через ---.

`kubectl apply -f Manifests/` целиком не запускай: подхватится `incidents/` и учебный кластер сломается по сценарию.

## Приложения

| Каталог | Что это |
|---------|---------|
| `payments-api/` | рабочий сервис: Namespace, ConfigMap, Secret, Deployment, Service |
| `config-server/` | Spring Cloud Config Server и его ClusterIP |
| `echo/` | крошечный сервис в namespace `lab`, чтобы потрогать DNS между namespace |

Перед применением каталога сначала создай namespace отдельной командой. `kubectl apply -f <каталог>/` не гарантирует, что Namespace будет обработан раньше остальных файлов: например, `configmap.yaml` сортируется раньше `namespace.yaml`.

```bash
kubectl apply -f Manifests/payments-api/namespace.yaml
kubectl apply -f Manifests/payments-api/

kubectl apply -f Manifests/config-server/namespace.yaml
kubectl apply -f Manifests/config-server/

kubectl apply -f Manifests/echo/namespace.yaml
kubectl apply -f Manifests/echo/
```

Повторное применение `namespace.yaml` внутри каталога безопасно для этого примера, поскольку оно декларативно задаёт тот же объект. Для собственных каталогов сохраняй явный bootstrap namespace перед namespaced-ресурсами.

`payments-api/service-nodeport.yaml` — только для учебного кластера без Ingress. В проде снаружи ходят через Ingress или облачный LoadBalancer.

Секрет в git — учебная заглушка. Настоящие пароли сюда не кладут.

## Инциденты

`incidents/01.yaml` … `07.yaml` специально сломаны. Это задания из [`labs/incidents.md`](../labs/incidents.md). Применяй только тот номер, до которого дошёл в истории.
