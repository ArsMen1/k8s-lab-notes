# Lab: Container exit codes и lifecycle

**Цель:** интерпретировать завершение контейнера по exit code, signal, termination reason и логам. Не делай вывод о причине только по одному коду.

## Сценарий

Pod периодически перезапускается. В `kubectl describe pod` видны предыдущий `Terminated` state и exit code. Команда дежурного — понять, завершилось ли приложение штатно, упало ли оно, было ли убито сигналом или достигло лимита ресурсов.

## Задача

1. Получи текущее и предыдущее состояние контейнера.
2. Сопоставь exit code, termination reason, signal, Events и логи.
3. Проверь команду запуска (`command`/`args`), restartPolicy и контроллер workload.
4. Отличи штатное завершение, application error, OOM и принудительное завершение.
5. Предложи безопасное исправление и подтверждение.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o yaml
kubectl logs <pod> -n <namespace> -c <container> --previous --tail=200
kubectl logs <pod> -n <namespace> -c <container> --tail=200
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl get deployment,replicaset,statefulset,job,cronjob -n <namespace> -o wide
```

В Pod YAML изучи `command`, `args`, `restartPolicy`, `resources`, а также `lastState.terminated` (reason, exitCode, startedAt, finishedAt). В `describe` проверь состояние контейнера и сообщения Events.

## Интерпретация кодов и сигналов

| Exit code / signal | Что может означать |
|---|---|
| `0` | Процесс завершился успешно; для постоянно работающего приложения это может быть неожиданно. |
| `1` | Общая ошибка приложения/команды; значение зависит от приложения. |
| `137` | Часто соответствует SIGKILL (128 + 9); возможен OOM kill, но код сам по себе не доказывает OOM. |
| `143` | Часто соответствует SIGTERM (128 + 15), например при остановке/rollout. |
| `OOMKilled` | Kubernetes/container runtime указывает, что контейнер завершён из-за превышения memory limit. |

Exit code может зависеть от runtime и приложения. Сопоставляй код с `reason`, Events, memory metrics и логами. SIGTERM обычно даёт процессу возможность завершиться корректно; SIGKILL не позволяет обработать graceful shutdown.

## Возможный root cause (открывай после попытки)

Контейнер завершён с `reason: OOMKilled`. Memory usage достиг лимита контейнера. Exit code 137 согласуется с SIGKILL, однако подтверждение OOM — именно termination reason/Events и соответствующие метрики, а не только число 137.

## Безопасное исправление

После подтверждения причины:

- оцени memory usage и наличие memory leak/всплеска потребления;
- проверь корректность memory request/limit;
- при необходимости скорректируй limit в рамках capacity и change process;
- не увеличивай limit вслепую — это может перенести проблему на Node;
- если проблема в lifecycle/команде, исправь команду или обработку завершения; если в Job, проверь expected completion и restartPolicy.

## Verification

- Pod/Job завершает или работает в соответствии с ожидаемым lifecycle.
- Exit reason больше не повторяется.
- Restart count стабилен для постоянно работающего workload.
- Memory usage не достигает опасного уровня, Node не испытывает pressure.
- Rollout и остановка приложения завершаются штатно.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
