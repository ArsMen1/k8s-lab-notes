# Lab: PodDisruptionBudget блокирует drain

**Цель:** понять, почему добровольное удаление Pod ограничено PDB, и как планировать maintenance без нарушения доступности.

## Сценарий

При плановом `kubectl drain` Node eviction не проходит. Вывод указывает, что PodDisruptionBudget не позволяет удалить дополнительные Pods (например, disruption budget exhausted). Maintenance останавливается, пока команда оценивает состояние приложения.

## Задача

1. Найди PDB, который выбирает affected Pods.
2. Проверь selector PDB и выбранные Pods.
3. Сопоставь `minAvailable` или `maxUnavailable`, текущую healthy/available replicas и статус disruptions.
4. Установи, почему budget исчерпан: мало replicas, unhealthy Pod, предыдущий disruption или некорректный selector.
5. Предложи безопасный план; не меняй PDB и не удаляй Pod.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get pdb -A
kubectl describe pdb <pdb> -n <namespace>
kubectl get pods -n <namespace> --show-labels -o wide
kubectl get deploy,sts -n <namespace>
kubectl describe node <node>
kubectl get events -A --sort-by=.metadata.creationTimestamp
```

В PDB сравни `Allowed disruptions`, `Current healthy`, `Desired healthy`, selector и disruptionsAllowed. Затем проверь фактическую доступность приложения (Service endpoints, readiness, метрики, SLO).

## Возможные причины

- Deployment/StatefulSet имеет мало replicas для заданного minAvailable/maxUnavailable.
- Pod уже unhealthy или не Ready.
- Предыдущий добровольный disruption уменьшил budget.
- PDB selector выбирает больше/других Pods, чем предполагалось.
- Параметры PDB не соответствуют требованиям availability приложения.

## Безопасное исправление

PDB — не препятствие, которое нужно обходить. Не удаляй PDB, не используй force eviction и не уменьшай minAvailable вслепую. Согласуй maintenance позже, восстанови healthy replicas либо пересмотри PDB вместе с владельцем приложения и SLO. Проверь capacity других Node до повторной попытки drain.

## Проверка

- PDB selector соответствует intended workload.
- Healthy replicas и availability соответствуют SLO.
- Плановый disruption разрешён без нарушения бюджета.
- После maintenance replicas, endpoints и пользовательские сигналы восстановлены.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Safe plan → Validation → Prevention.
