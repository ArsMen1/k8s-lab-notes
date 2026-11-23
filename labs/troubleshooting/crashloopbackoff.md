# Lab: CrashLoopBackOff

**Цель:** найти причину повторных завершений контейнера, используя доказательства, а не удаляя Pod или перезапуская workload вслепую.

## Сценарий

Пользователи сообщают, что приложение недоступно. Pod показывает `CrashLoopBackOff`, restart count растёт. После последнего запуска контейнер не работает стабильно.

## Задача

1. Зафиксируй namespace, Pod, время, restart count и impact.
2. Получи состояние и Events.
3. Изучи логи текущего и предыдущего контейнера.
4. Сформулируй 2–3 гипотезы и укажи, какие данные подтверждают/опровергают каждую.
5. Предложи минимальное безопасное исправление и способ проверки.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl logs <pod> -n <namespace> -c <container> --tail=200
kubectl logs <pod> -n <namespace> -c <container> --previous --tail=200
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl get deployment,replicaset -n <namespace>
```

Не выводи Secret и credentials в тикет или отчёт. Сохрани логи до любых действий, которые могут перезапустить контейнер.

## Ключевые различия

- `CrashLoopBackOff` — состояние back-off после повторных неудачных запусков, а не root cause.
- `kubectl logs --previous` показывает лог предыдущего завершившегося экземпляра контейнера, если он доступен.
- Exit code сам по себе недостаточен: сопоставь его с termination reason, Events и логами.
- Pod может перезапускаться из-за ошибки приложения, команды/аргументов, конфигурации, probe, зависимости или ресурсов.

## Проверка восстановления

- Pod Ready и restart count больше не растёт.
- Service имеет ready endpoints.
- Запрос к приложению проходит.
- Error rate и latency вернулись к baseline.

## Разбор (открывай после попытки)

Не существует одного универсального root cause. Примеры причин: неверная команда запуска, отсутствующий конфиг, приложение не может подключиться к dependency, ошибка старта или probe, memory limit. Root cause считается установленным только после подтверждения логами/Events/конфигурацией.

## Incident report

Запиши: Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
