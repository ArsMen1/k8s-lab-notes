# Lab: Pod Running, но приложение недоступно

**Цель:** расследовать ситуацию, когда Kubernetes считает Pod запущенным, но приложение недоступно по сети. Не путай состояние Pod с готовностью приложения принимать запросы.

## Сценарий

Deployment успешно создал Pod. Pod отображается как `Running`, но клиент получает `Connection refused` при обращении к приложению через Service. Внешне Pod не перезапускается, Events не показывают очевидных ошибок.

## Задача

1. Проверь контекст, namespace, Pod, Deployment и Service.
2. Сопоставь labels, selector, ports и targetPort.
3. Установи, на каком интерфейсе и порту слушает процесс приложения.
4. Отличи `Connection refused` от timeout и HTTP-ошибки.
5. Сформулируй root cause на основании данных и предложи минимальное исправление.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get pod -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get svc <service> -n <namespace> -o yaml
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service> -o yaml
kubectl get pods -n <namespace> --show-labels
kubectl get deployment,replicaset -n <namespace> -o wide
kubectl logs <pod> -n <namespace> -c <container> --tail=200
```

Если в контейнере есть диагностические утилиты, проверь порт и адрес прослушивания без изменения состояния:

```bash
kubectl exec <pod> -n <namespace> -c <container> -- sh -c 'ss -lntp || netstat -lnt'
```

Проверяй соединение из разрешённого диагностического Pod или из подходящего source namespace. Не устанавливай утилиты в production-контейнер ради диагностики.

## Что нужно различить

- `Connection refused`: соединение отвергается; часто на адресе/порту нет listener или соединение активно отвергается.
- `Timeout`: ответ не приходит вовремя; возможны сетевые ограничения, routing, policy или зависание.
- HTTP 4xx/5xx: TCP/HTTP путь до отвечающего компонента работает, дальше исследуй protocol, route, application или dependency.
- Service без endpoints: исследуй selector, labels и readiness (см. [Service без ready endpoints](service-no-endpoints.md)).
- Listener на `127.0.0.1`: процесс доступен только внутри loopback контейнера; запросы к Pod IP могут не проходить.

## Возможный root cause (открывай после попытки)

Приложение настроено слушать `127.0.0.1:8080`. Внутри контейнера локальная проверка проходит, но соединения через Pod IP отвергаются. Service selector и targetPort корректны, endpoints присутствуют.

## Безопасное исправление

В конфигурации приложения установи bind address, доступный интерфейсу Pod, например `0.0.0.0`, сохрани нужный port. Измени только конфигурацию, относящуюся к listener. Не меняй Service, NetworkPolicy или другие компоненты без подтверждённой причины. Выполни rollout по принятому процессу в учебном окружении.

## Verification

- Новый Pod Ready и не перезапускается.
- Listener использует ожидаемый порт и адрес.
- EndpointSlice содержит ожидающий backend.
- Проверка соединения из нужного source проходит.
- HTTP response соответствует ожидаемому.
- Error rate и latency возвращаются к baseline.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Mitigation → Validation → Prevention.
