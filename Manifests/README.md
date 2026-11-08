# Manifests

Здесь только желаемое состояние. Один файл — один `kind`. Так это выглядит в ревью, а не в учебном примере «всё через `---`».

`kubectl apply -f Manifests/` целиком не запускай: подхватится `incidents/` и учебный кластер сломается по сценарию.

## Приложения

| Каталог | Что это |
|---------|---------|
| `payments-api/` | рабочий сервис: Namespace, ConfigMap, Secret, Deployment, Service |
| `config-server/` | Spring Cloud Config Server и его ClusterIP |
| `echo/` | крошечный сервис в namespace `lab`, чтобы потрогать DNS между namespace |

Порядок файлов внутри каталога не важен. Каталог целиком:

```bash
kubectl apply -f Manifests/payments-api/
kubectl apply -f Manifests/config-server/
kubectl apply -f Manifests/echo/
```

`payments-api/service-nodeport.yaml` — только для учебного кластера без Ingress. В проде снаружи ходят через Ingress или облачный LoadBalancer.

Секрет в git — учебная заглушка. Настоящие пароли сюда не кладут.

## Инциденты

`incidents/01.yaml` … `07.yaml` специально сломаны. Это задания из [`labs/incidents.md`](../labs/incidents.md). Применяй только тот номер, до которого дошёл в истории.
