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

`<unknown>` / `FailedGetResourceMetric`: сначала проверь доступность resource metrics API и наличие актуальных samples, затем CPU requests у всех контейнеров, участвующих в CPU utilization, и корректность `scaleTargetRef`/selector. Новые, NotReady Pod и отсутствующие для отдельных Pod samples могут быть исключены из первичного расчёта и консервативно влиять на scaling; сами по себе они не всегда означают отказ Metrics API. Смотри Conditions и Events конкретного HPA.

Связано: [Resources/QoS](../12-resources-qos/README.md), [HPA manifests](../../Manifests/hpa/README.md), [P1 labs](../../labs/fundamentals-p1/README.md).
Официально: [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/), [autoscaling/v2 API](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/horizontal-pod-autoscaler-v2/).
