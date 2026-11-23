# Lab: Permission denied на смонтированном volume

**Цель:** определить, почему контейнер не может читать или записывать файлы на PVC, и исправить права без опасного изменения данных.

## Сценарий

Pod успешно стартовал и PVC находится в `Bound`, но приложение пишет ошибку `Permission denied` при чтении или создании файла в mount path. Ошибка может быть связана с владельцем каталога, UID/GID процесса, режимом доступа или настройками securityContext.

## Задача

1. Подтверди, что PVC Bound и mount успешен.
2. Найди mount path и UID/GID процесса в контейнере.
3. Проверь владельца и права директории/файлов.
4. Изучи `runAsUser`, `runAsGroup`, `fsGroup` и ограничения CSI/backend.
5. Предложи минимально необходимое исправление и объясни риски.

## Read-only диагностика

```bash
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o yaml
kubectl describe pvc <claim> -n <namespace>
kubectl exec <pod> -n <namespace> -- id
kubectl exec <pod> -n <namespace> -- sh -c 'ls -ldn <mount-path>; ls -ln <mount-path>'
```

Если образ не содержит `sh`, `id` или `ls`, используй подходящий диагностический контейнер/инструмент, согласованный с платформой. Не выводи содержимое файлов с секретами.

## Возможные причины

- Процесс работает под UID/GID, не имеющим прав на каталог.
- Владелец или group каталога отличается от ожидаемого.
- Режимы доступа слишком ограничены.
- `fsGroup` отсутствует, некорректен или не поддерживается способом mount/CSI.
- Backend применяет ACL или особенности NFS/root-squash.
- Filesystem смонтирована read-only либо приложение пытается писать в неверный путь.

## Безопасное исправление

Сначала установи требуемые UID/GID и модель доступа приложения. В disposable окружении можно проверять корректный `securityContext` (`runAsUser`, `runAsGroup`, `fsGroup`) на новом тестовом volume. Не выполняй рекурсивный `chown`/`chmod` на существующих production данных без оценки масштаба, согласования и backup. Не запускай приложение от root просто для обхода проблемы.

## Проверка

- Приложение использует ожидаемый UID/GID.
- Тест чтения/записи в предназначенный каталог успешен.
- Доступ к файлам за пределами требуемого scope не расширен.
- Pod остаётся Ready, ошибки permission больше не повторяются.

## Prevention

- Документируй UID/GID приложения и требования к каталогу данных.
- Добавляй securityContext в deployment template и проверяй его в review.
- Проверяй permissions на новом volume до запуска workload.
- Учитывай особенности CSI/backend и файловой системы.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Safe fix → Validation → Prevention.
