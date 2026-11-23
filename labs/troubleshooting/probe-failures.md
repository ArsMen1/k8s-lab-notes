# Lab: Probe failures (Readiness, Liveness, Startup)

**Цель:** определить, какая probe нарушает работу Pod, и исправить проверки так, чтобы они отражали реальное состояние приложения, а не вызывали лишние рестарты или отправку трафика в неготовый backend.

## Сценарий

После релиза Pod запускается, но restart count растёт. В Events видны сообщения о failed liveness probe. Приложение медленно стартует из-за прогрева или загрузки данных; probe начинает проверять его слишком рано. В некоторых случаях Pod может быть Running, но Ready = 0/1.

## Задача

1. Определи тип и настройки каждой probe.
2. Сопоставь события probe с логами приложения и временем старта.
3. Объясни разницу между Readiness, Liveness и Startup.
4. Проверь path/port/protocol/command, delay, period, timeout и failure threshold.
5. Предложи исправление, учитывающее реальное время запуска приложения, и опиши validation.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get pods -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get pod <pod> -n <namespace> -o yaml
kubectl logs <pod> -n <namespace> -c <container> --tail=200
kubectl logs <pod> -n <namespace> -c <container> --previous --tail=200
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl get deployment <deployment> -n <namespace> -o yaml
```

При анализе YAML найди `startupProbe`, `readinessProbe`, `livenessProbe` и параметры:

- `initialDelaySeconds`
- `periodSeconds`
- `timeoutSeconds`
- `failureThreshold`
- `successThreshold`

## Ключевые различия

- **Readiness** — определяет, готов ли Pod получать трафик. Неуспешная readiness сама по себе не должна перезапускать контейнер.
- **Liveness** — выявляет состояние, когда контейнер необходимо перезапустить. Неправильно настроенная liveness может создать restart loop.
- **Startup** — даёт медленно стартующему приложению время и защищает его от преждевременных liveness/readiness проверок во время запуска.

Probe должна проверять правильный endpoint/port и адекватно отражать состояние. Проверка внешней зависимости в liveness может вызвать лавину рестартов при проблеме зависимости.

## Возможный root cause (открывай после попытки)

У приложения увеличилось время инициализации после релиза. Liveness probe начинает проверки до завершения старта и срабатывает по failure threshold. Контейнер перезапускается, а приложение не успевает стать Ready.

## Безопасное исправление

В разрешённом окружении скорректируй probe согласно ожидаемому startup time и фактическому поведению приложения. Для долгого запуска используй Startup Probe; Readiness должна отражать способность обслуживать запросы, а Liveness — необходимость перезапуска при необратимом зависании. Не отключай probe без обоснования и не делай liveness зависимой от недоступной внешней системы без необходимости.

## Verification

- Startup завершается успешно при ожидаемом времени запуска.
- Pod Ready только после того, как приложение действительно готово.
- Restart count перестал расти.
- Liveness не вызывает лишних рестартов.
- При контролируемой проверке readiness приложение исключается из трафика, а после восстановления возвращается.
- После rollout нет деградации error rate или latency.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
