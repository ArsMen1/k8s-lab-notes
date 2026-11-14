# Horizontal Pod Autoscaler (HPA) и metrics

HPA — controller, который периодически меняет desired replica count workload по наблюдаемым метрикам. Он не создаёт метрики и не заменяет capacity planning.

## API и prerequisites

Используй autoscaling/v2. HPA ссылается на масштабируемый объект в том же namespace. Для CPU utilization нужны CPU requests у контейнеров: utilization считается относительно request, а не CPU limit или всей Node. Для resource metrics обычно нужен metrics-server; custom/external metrics требуют adapter/API.

## Scaling behavior

autoscaling/v2 позволяет задавать scaleUp/scaleDown behavior: stabilizationWindowSeconds, selectPolicy и policies. Scale down часто делают плавнее, чтобы избежать flapping. Учитывай startup time, readiness, PDB и downstream capacity. В GitOps-процессе явно определи, кто управляет replicas, чтобы HPA не конфликтовал с декларативным манифестом.

## Диагностика

    kubectl get hpa -A
    kubectl describe hpa <name> -n <namespace>
    kubectl top pods -n <namespace>
    kubectl get apiservices | grep metrics
    kubectl get deployment <name> -n <namespace> -o yaml
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Unknown/FailedGetResourceMetric: metrics API недоступен, нет CPU requests, Pod не Ready/не имеет метрик, selector неверен или targetRef не совпадает.

Связано: [Resources/QoS](../12-resources-qos/README.md), [HPA manifests](../../Manifests/hpa/README.md), [P1 labs](../../labs/fundamentals-p1/README.md).
Официально: [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/), [autoscaling/v2 API](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/horizontal-pod-autoscaler-v2/).
