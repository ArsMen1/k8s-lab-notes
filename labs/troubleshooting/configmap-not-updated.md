# Lab: ConfigMap changes не применяются к приложению

**Цель:** выяснить, почему обновлённая конфигурация Kubernetes не соответствует фактической конфигурации работающего приложения, и определить безопасный способ её применения.

## Сценарий

Команда изменила ConfigMap и ожидает, что приложение начнёт использовать новые настройки. Однако поведение приложения не изменилось: оно продолжает использовать старое значение, хотя ConfigMap уже содержит обновлённые данные.

## Задача

1. Проверь актуальную конфигурацию ConfigMap и способ её подключения к Pod.
2. Определи, используется ли ConfigMap как environment variables, volume mount или через `subPath`.
3. Сопоставь время изменения ConfigMap, состояние Pod и поведение приложения.
4. Выясни, умеет ли приложение перечитывать конфигурацию без перезапуска.
5. Предложи минимальное безопасное решение и verification.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get pods -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o yaml
kubectl get configmap <configmap> -n <namespace> -o yaml
kubectl describe configmap <configmap> -n <namespace>
kubectl get deployment <deployment> -n <namespace> -o yaml
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
```

При просмотре ConfigMap не публикуй конфигурационные значения, которые могут содержать чувствительные данные. Для credentials используй Secret и approved secret-management workflow; не выводи содержимое Secret.

## Что нужно различить

- **Environment variables из ConfigMap:** значения попадают в окружение контейнера при его создании; изменение ConfigMap само по себе не обновляет environment запущенного процесса.
- **Mounted ConfigMap volume:** обновление файлов может происходить с задержкой; приложение должно уметь перечитывать файл или реагировать на изменения.
- **Mount через `subPath`:** такой файл не получает автоматических обновлений ConfigMap.
- **Application caching:** файл может обновиться, но приложение продолжает использовать закэшированное значение.
- **Wrong reference:** Pod использует другой ConfigMap, namespace, key или workload revision.

## Возможный root cause (открывай после попытки)

ConfigMap подключён к Deployment через environment variables. ConfigMap уже обновлён, но запущенные контейнеры сохранили значения, полученные при старте. Pod не пересоздавались, поэтому приложение продолжает работать со старой конфигурацией.

## Безопасное исправление

1. Убедись, что изменён правильный ConfigMap и key.
2. Проверь, что новое значение безопасно и соответствует ожидаемой конфигурации.
3. Если конфигурация передаётся через environment variables, запланируй контролируемый rollout/restart workload по change process.
4. Если это volume mount, проверь, обновился ли файл, и поддерживает ли приложение reload. Если используется `subPath`, потребуется предусмотренный процесс пересоздания Pod.
5. Не перезапускай workload до сохранения evidence и оценки влияния.

## Verification

- Новый Pod использует ожидаемую revision/configuration.
- Приложение подтверждённо загрузило новую настройку (по безопасному диагностическому признаку, не раскрывающему секреты).
- Readiness остаётся успешной.
- Поведение приложения соответствует ожидаемому.
- Error rate, latency и restart count не ухудшились.
- Rollout завершился успешно и все replicas healthy.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
