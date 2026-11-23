# Lab: Pod Pending — Scheduler не находит подходящую Node

**Цель:** установить, почему Pod не может быть назначен на Node, и отличить нехватку ресурсов от scheduling constraints.

## Сценарий

Новый Pod или replica после scale-up остаётся в `Pending`. Events содержат `FailedScheduling`: например, `Insufficient cpu`, `Insufficient memory`, `node(s) had untolerated taint`, `didn't match Pod's node affinity` или `volume node affinity conflict`.

## Задача

1. Зафиксируй namespace, workload и impact: это новая replica или весь сервис?
2. Прочитай полный текст FailedScheduling Events.
3. Сопоставь requests с allocatable и уже выделенными requests на подходящих Node.
4. Проверь taints/tolerations, nodeSelector/affinity, topology, PVC и quota.
5. Предложи исправление, не ослабляя constraints вслепую.

## Read-only диагностика

```bash
kubectl config current-context
kubectl describe pod <pod> -n <namespace>
kubectl get pods -n <namespace> -o wide
kubectl get nodes --show-labels
kubectl describe nodes
kubectl get resourcequota,limitrange -n <namespace>
kubectl get pvc -n <namespace>
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
```

В `describe node` сравни Capacity, Allocatable и Allocated resources. `kubectl top` показывает usage, но Scheduler размещает Pod по requests, а не текущему потреблению.

## Возможные причины

- Requests новых Pod не помещаются в allocatable подходящих Node.
- Taint не допускает размещение (нет подходящей toleration).
- nodeSelector/required affinity не совпадает с labels.
- Topology spread или volume node affinity ограничивает варианты.
- ResourceQuota/LimitRange ограничивает создание или ресурсы Pod.

## Безопасное исправление

Не снижай requests автоматически и не добавляй tolerations/labels без понимания требований. Рассмотри обоснованную корректировку requests, добавление capacity, исправление ошибочного selector/affinity или quota через согласованный change process.

## Проверка

- Pod назначен на ожидаемую Node.
- Pod Ready, replicas и endpoints восстановлены.
- Другие workloads не стали resource-starved.
- Node pressure и capacity остаются в безопасных пределах.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Safe fix → Validation → Prevention.
