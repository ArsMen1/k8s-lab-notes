# Liveness, Readiness, Startup probes

Без проб Kubernetes знает только: «контейнер запущен». С пробами он знает: «приложение живое» и «можно ли слать трафик».

## Три типа

### ReadinessProbe — можно ли слать трафик?

Если проверка падает:

1. Под остается живым.
2. Но его IP **убирают из Endpoints** Service.
3. Клиенты перестают попадать на него.

Нужен при старте, прогреве кэша, временной перегрузке.

### LivenessProbe — жив ли процесс по смыслу?

Если проверка падает:

1. kubelet **убивает** контейнер.
2. Затем перезапускает его по `restartPolicy`.

Нужен при deadlock / зависании, когда процесс есть, а пользы нет.

### StartupProbe — долгий старт

Для приложений, которые стартуют минутами. Пока startup не успешен, liveness/readiness не трогают контейнер. Иначе liveness убьет еще не поднявшееся приложение.

## Как проверяют

- `httpGet` — HTTP endpoint (`/healthz`, `/ready`)
- `tcpSocket` — порт открыт?
- `exec` — команда внутри контейнера

## Опасности

- Слишком агрессивный liveness → постоянные рестарты (CrashLoopBackOff).
- Readiness на тяжёлый endpoint → под выпадает из балансировки под нагрузкой.
- Один и тот же URL для liveness и readiness — часто плохая идея.

## Минимальный пример

```yaml
readinessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 3
  periodSeconds: 5
livenessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 10
  periodSeconds: 10
```

Практика: `Manifests/probes/payments-api-with-probes.yaml`

## Полезные команды

```bash
kubectl get endpoints payments-svc
kubectl describe pod <имя>   # смотри Ready / Last State / Events
kubectl get pods -o wide
```

## Связанные заметки

- Service и Endpoints: [[why-service]]
- Отладка: [[kubectl-debug]]
