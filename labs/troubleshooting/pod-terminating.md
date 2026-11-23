# Lab: Pod stuck in Terminating

**Цель:** безопасно расследовать Pod, который долго находится в состоянии `Terminating`, понять, что мешает завершению, и не прибегать к force delete без доказательств и оценки последствий.

## Сценарий

Deployment выполняет rollout или Pod удаляется вручную, но один из Pods долго остаётся в `Terminating`. Новая replica уже запущена либо rollout застопорился. Нужно понять, связан ли процесс завершения с приложением, lifecycle hooks, Node/kubelet, storage или finalizers.

## Задача

1. Зафиксируй, сколько времени Pod находится в Terminating и что за workload им управляет.
2. Изучи deletion timestamp, Events, container state и Node.
3. Проверь lifecycle hooks, grace period и состояние workload.
4. Определи, есть ли finalizers, зависший процесс или проблема Node/kubelet.
5. Предложи безопасное действие с учётом риска для пользователей и данных.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o yaml
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl get deployment,replicaset,statefulset -n <namespace> -o wide
kubectl describe node <node>
```

В Pod YAML обрати внимание на:

- `metadata.deletionTimestamp`
- `metadata.finalizers`
- `spec.terminationGracePeriodSeconds`
- `spec.containers[].lifecycle.preStop`
- container state / lastState
- Node, на которой размещён Pod

Проверь логи приложения и доступные monitoring signals. Для kubelet, runtime, CSI и Node-level процессов используй approved platform diagnostics или передай расследование владельцу платформы.

## Что нужно различить

- **Graceful shutdown:** приложение завершает текущие запросы или выполняет shutdown sequence.
- **preStop hook:** hook выполняется перед отправкой сигнала завершения; его длительность учитывается в lifecycle termination.
- **SIGTERM / SIGKILL:** процессу дают время завершиться, затем он может быть принудительно остановлен после grace period.
- **Finalizers:** API object не удаляется окончательно, пока контроллер не выполнит требуемую очистку.
- **Node unreachable:** API может показывать Pod terminating, хотя kubelet на Node недоступен и фактическое завершение процесса не подтверждено.
- **Storage / detach:** зависание может быть связано с volume lifecycle и CSI, особенно у stateful workload.

## Возможный root cause (открывай после попытки)

В Deployment настроен долгий `preStop` hook, который ожидает завершения drain/connection process, но процесс завис. Hook не завершается, Pod задерживается в Terminating. Force delete не решит проблему корректно на уровне приложения и может привести к незавершённому shutdown.

## Безопасное исправление

- Уточни, принимает ли старый Pod трафик и есть ли healthy replacement.
- Проверь PDB, replicas, stateful/data impact и owner workload.
- Если проблема в hook/shutdown, согласуй изменение lifecycle и rollout.
- Если finalizer связан с контроллером или storage, выясни назначение finalizer и состояние соответствующей очистки.
- Force delete (`kubectl delete pod --force --grace-period=0`) — крайняя мера: API object может исчезнуть без подтверждения остановки процесса на Node. Не используй её в production без согласования, оценки риска и процедуры владельца платформы.

## Verification

- Старый Pod завершился штатно, object удалён.
- Новый workload имеет ожидаемое количество replicas и Ready Pods.
- Нет оставшихся volume attachment или cleanup операций.
- Сервис работает, error rate/latency нормальны.
- Rollout/termination завершился, новых зависших Pods нет.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
