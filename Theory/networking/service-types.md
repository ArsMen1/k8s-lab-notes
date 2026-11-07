# Типы Service: ClusterIP, NodePort, LoadBalancer

Service всегда дает стабильный виртуальный IP и DNS. Меняется только **откуда** до него можно достучаться.

## ClusterIP (по умолчанию)

- Доступен **только внутри** кластера.
- DNS: `payments-svc.default.svc.cluster.local`
- Типичный кейс: backend, который дергают другие поды / Ingress.

Практика: `Manifests/service-and-dns/service.yaml`

## NodePort

- Kubernetes открывает высокий порт (обычно 30000–32767) **на каждой ноде**.
- Снаружи: `http://<IP-любой-ноды>:<nodePort>`
- Удобно для учебных стендов и демо. В проде почти всегда заменяют на LoadBalancer / Ingress.

```yaml
type: NodePort
ports:
  - port: 80
    targetPort: 80
    nodePort: 30080   # можно не указывать — выберется сам
```

Практика: `Manifests/service-and-dns/service-nodeport.yaml`

## LoadBalancer

- Создает внешний балансировщик у облака (AWS/GCP/Azure).
- В локальном Kind/Minikube часто «висит» в `pending`, пока нет cloud-provider / MetalLB.
- Снаружи получаешь внешний IP.

## Headless (`clusterIP: None`)

- Нет виртуального ClusterIP.
- DNS возвращает IP подов напрямую.
- Нужен для StatefulSet / клиентского discovery (Kafka, databases).

## Что выбрать на практике

| Цель | Тип |
|------|-----|
| Сервис только внутри кластера | ClusterIP |
| Быстро открыть наружу в лабе | NodePort |
| Облако + внешний IP | LoadBalancer |
| HTTP-роутинг по доменам/путям | Ingress → ClusterIP |

## Связанные заметки

- Зачем вообще Service: [[why-service]]
- Endpoints: [[where-are-endpoints-stored]]
- Дальше по сети: Ingress (пока в глоссарии) — [[glossary-core-objects#Ingress]]
