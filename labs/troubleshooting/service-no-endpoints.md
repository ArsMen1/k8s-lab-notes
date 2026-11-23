# Lab: Service без ready endpoints

**Цель:** диагностировать путь Deployment → Pod → Service → EndpointSlice и понять, почему Service не направляет трафик на backend.

## Сценарий

Service существует, DNS-имя разрешается, но запросы не проходят. В EndpointSlice не отображаются ожидаемые ready backend endpoints (или список пуст). Не предполагай заранее, что виноват Service.

## Задача

1. Проверь Service selector и labels Pod.
2. Проверь readiness состояние Pod и Events.
3. Сопоставь Service port/targetPort с портом приложения.
4. Проверь EndpointSlice.
5. Сформулируй причину и безопасное исправление.

## Read-only диагностика

```bash
kubectl get svc <service> -n <namespace> -o yaml
kubectl get pods -n <namespace> --show-labels -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service> -o yaml
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
```

При необходимости дополнительно изучи:

```bash
kubectl get deployment,replicaset -n <namespace> -o wide
kubectl get networkpolicy -n <namespace>
```

## Возможные причины

- Selector Service не совпадает с labels Pod.
- Pod не Ready; endpoint может быть исключён из ready-трафика.
- Service targetPort не соответствует порту контейнера.
- Приложение слушает только loopback вместо интерфейса Pod.
- NetworkPolicy или CNI нарушает доступность (это не объясняет отсутствие endpoints само по себе, но может объяснять неуспешный запрос).

## Безопасное исправление

Измени только подтверждённый слой: selector/labels, port mapping, настройку приложения или policy. Не удаляй Service и Pod как диагностический первый шаг; не отключай NetworkPolicy глобально.

## Проверка

- EndpointSlice содержит ожидаемые endpoints и корректные ports.
- Backend Pod Ready.
- Запрос проходит из ожидаемого source namespace.
- Соседние сервисы и ограничения сети не ослаблены.

## Разбор

Service selector выбирает Pods по labels; EndpointSlice отражает backend endpoints. Отсутствие endpoints обычно указывает на selector mismatch или отсутствие подходящих/готовых Pods, но уточняй состояние EndpointSlice и readiness. Отдельно различай DNS resolution, TCP connection refused и timeout.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
