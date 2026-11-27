# Gateway API: HTTP 404/503 и Route не подключается

Практическая лаборатория для Production Support Engineer. Цель — локализовать проблему между GatewayClass/controller, Gateway listener, HTTPRoute attachment, backendRef, Service и Pod.

> Это runbook для разбора инцидента. Он не устанавливает CRD/controller и не применяет манифесты. Все команды первичной диагностики read-only. Исправления выполняются только в изолированном тестовом кластере после согласования.

## 1. Сценарий и симптомы

Приложение `catalog` доступно через Gateway API по `http://catalog.example.test/`. После изменения маршрутизации клиенты получают 404 или 503. Вариант инцидента: HTTPRoute существует, но трафик через Gateway не доходит до Service.

Влияние: внешний HTTP трафик к одному hostname/path нарушен; другие Routes на том же Gateway могут работать.

Не предполагай, что 404 всегда означает отсутствие Route, а 503 всегда означает пустые endpoints. Сначала определи, кто вернул ответ: Gateway dataplane или backend application.

## 2. Prerequisites тестовой среды

Для воспроизведения нужен отдельный кластер с:
- Gateway API CRD, совместимыми с выбранной версией controller;
- установленным и Ready Gateway controller;
- созданным controller-ом или администратором GatewayClass;
- Gateway с HTTP listener и доступным address;
- тестовым backend Service и Pod;
- разрешённым способом отправить HTTP-запрос к адресу Gateway.

Для конкретного примера можно выбрать **Envoy Gateway**. Перед лабораторией зафиксируй версию Envoy Gateway и следуй его официальному install guide и compatibility matrix. Не копируй controllerName или команды установки из примера для другой реализации. Наличие Ingress NGINX/Traefik не означает автоматически, что Gateway API controller установлен.

Если prerequisites отсутствуют — лабораторию проходить как анализ обезличенных YAML/status, не устанавливая компоненты в рабочем кластере.

## 3. Первичная read-only диагностика

Проверь контекст и наличие API:

```bash
kubectl config current-context
kubectl get crd gateways.gateway.networking.k8s.io
kubectl get crd gatewayclasses.gateway.networking.k8s.io
kubectl get crd httproutes.gateway.networking.k8s.io
kubectl api-resources --api-group=gateway.networking.k8s.io
```

Найди класс и controller:

```bash
kubectl get gatewayclass -o wide
kubectl get gatewayclass <class-name> -o yaml
kubectl get pods,deployments -A | grep -Ei 'envoy|gateway|istio|kong|nginx'
```

Посмотри Gateway и Route:

```bash
kubectl get gateway -A -o wide
kubectl describe gateway <gateway> -n <gateway-namespace>
kubectl get gateway <gateway> -n <gateway-namespace> -o yaml
kubectl get httproute -A -o wide
kubectl describe httproute <route> -n <route-namespace>
kubectl get httproute <route> -n <route-namespace> -o yaml
```

Не публикуй TLS Secret data, kubeconfig или credentials. В YAML достаточно metadata, spec (без секретных inline extensions) и status.

## 4. Проверка route attachment

Сопоставь поля в обе стороны:

1. HTTPRoute `spec.parentRefs[].name/namespace` указывает на правильный Gateway?
2. Если указан `sectionName`, существует ли listener с таким точным именем?
3. Listener разрешает `HTTPRoute` через `allowedRoutes.kinds`?
4. Разрешён ли namespace Route: `Same`, `All` или подходящий `Selector`?
5. Если заданы hostnames на Route и listener, есть ли пересечение?
6. Protocol listener совместим с HTTPRoute?

Read-only проверки:

```bash
kubectl get namespace <route-namespace> --show-labels
kubectl get gateway <gateway> -n <gateway-namespace> -o yaml
kubectl get httproute <route> -n <route-namespace> -o yaml
```

### Вероятная root cause A: Route не прикрепился

Признаки: в `status.parents[]` нет ожидаемого parent/listener либо condition `Accepted=False`. Reason/message могут указывать на namespace not allowed, unsupported kind, hostname mismatch или invalid listener selection.

Безопасное исправление в тестовой среде: согласовать namespace selector/kinds на listener либо исправить parentRef/sectionName/hostname. Не выставляй `allowedRoutes.namespaces.from: All` только ради прохождения упражнения.

## 5. Проверка conditions и generation

Проверяй не только spec, но и status:

| Объект | Conditions |
|---|---|
| GatewayClass | `Accepted` |
| Gateway | `Accepted`, `Programmed` |
| Listener | `Accepted`, `Programmed`, `ResolvedRefs` |
| HTTPRoute parent entry | `Accepted`, `ResolvedRefs` |

Для каждой condition выпиши `status`, `reason`, `message`, `observedGeneration`, `lastTransitionTime`. Убедись, что controller обработал текущую generation, а не только старую конфигурацию.

### Вероятная root cause B: GatewayClass не обслуживается controller

Признаки: GatewayClass отсутствует, `Accepted=False/Unknown`, controller deployment отсутствует/не Ready либо `spec.controllerName` не соответствует установленной реализации.

Безопасное исправление: передать владельцу платформы проверку установки/совместимости controller и GatewayClass. Не создавай GatewayClass с выдуманным controllerName: это не устанавливает controller.

## 6. Проверка backendRefs → Service → EndpointSlice

```bash
kubectl get svc <service> -n <app-namespace> -o yaml
kubectl describe svc <service> -n <app-namespace>
kubectl get endpointslices -n <app-namespace> -l kubernetes.io/service-name=<service> -o wide
kubectl get pods -n <app-namespace> -o wide --show-labels
kubectl get events -n <app-namespace> --sort-by=.lastTimestamp
```

Сверь:
- `backendRefs.name` совпадает с Service name;
- `backendRefs.port` совпадает с `spec.ports[].port` Service, не с containerPort;
- Service selector совпадает с labels Pod;
- EndpointSlice содержит ожидаемые адреса и ready endpoints;
- Service и HTTPRoute в одном namespace, если нет корректно разрешённой cross-namespace ссылки;
- для backendRef в другом namespace есть подходящий ReferenceGrant в namespace backend.

### Вероятная root cause C: backendRef не разрешён

Признаки: HTTPRoute `ResolvedRefs=False`; reason/message указывает на отсутствующую Service, порт или запрещённую cross-namespace reference.

Безопасное исправление: исправить имя/порт Service либо добавить минимальный ReferenceGrant в namespace целевого ресурса по change process. Не расширяй ReferenceGrant до wildcard без обоснования.

### Вероятная root cause D: Service не имеет ready endpoints

Признаки: HTTPRoute `Accepted=True` и `ResolvedRefs=True`, но EndpointSlice пуст или не содержит ready адресов; Gateway может вернуть 503.

Безопасное исправление: выяснить причину отсутствия Pod endpoints — selector mismatch, readiness failure, rollout, scheduling или приложение. Исправлять первопричину workload, а не обходить readiness и не направлять трафик на неподготовленные Pod.

## 7. Разбор HTTP 404 и 503

| Ответ | Возможная причина | Чем подтвердить |
|---|---|---|
| 404 | HTTPRoute не attached или нет совпадения host/path | parent conditions, listener hostname, Host header, path matches |
| 404 | Backend application вернул Not Found | access/application logs, трассировка до backend |
| 503 | Нет healthy endpoints или Service port неверен | EndpointSlice, Service ports, Pod readiness |
| 503 | backendRef не разрешён | HTTPRoute `ResolvedRefs` и reason |
| 503 | dataplane/controller не запрограммирован или backend connection failure | Gateway `Programmed`, listener conditions, controller logs |

Выполни HTTP smoke test только из разрешённой тестовой точки и с известным address:

```bash
curl -i --connect-timeout 3 --max-time 10 -H 'Host: catalog.example.test' http://<gateway-address>/
```

Не запускай нагрузочные тесты. Если используется TLS, проверяй корректный hostname/SNI и доверенную тестовую цепочку; не отключай проверку сертификата как постоянное исправление.

## 8. Controller logs и Events

Сначала определи точный namespace/deployment controller по GatewayClass и документации реализации. Затем ограничь объём чтения:

```bash
kubectl logs -n <controller-namespace> deploy/<controller-deployment> --since=15m --tail=200
kubectl get events -n <gateway-namespace> --sort-by=.lastTimestamp
kubectl get events -n <route-namespace> --sort-by=.lastTimestamp
```

Ищи сообщения о rejected config, listener conflict, route attachment, unresolved reference, backend cluster/endpoints и programming failure. Тексты и уровни логирования зависят от controller.

## 9. Безопасное исправление и verification

После подтверждения root cause и согласования change:

1. Сохрани до изменения Gateway/Route YAML (без Secret data), conditions, Events, object generation и response sample.
2. Исправь одну причину за раз: parentRef, sectionName, hostname, allowedRoutes selector/kinds, backend Service port/namespace или минимальный ReferenceGrant.
3. Не удаляй Gateway/Service/Pod и не перезапускай controller как первый шаг.
4. После изменения проверь, что `observedGeneration` актуален; Gateway `Accepted=True` и `Programmed=True`; listener и HTTPRoute parent conditions `Accepted=True`; `ResolvedRefs=True`.
5. Убедись, что Service имеет ожидаемые ready EndpointSlice addresses.
6. Повтори ограниченный HTTP smoke test с правильным Host и path; зафиксируй response code, latency и backend evidence.
7. Проверь соседние Routes и listener, чтобы исключить регрессию.

## 10. Задание

Не открывая разделы root cause заранее, подготовь incident report:

- Какой слой первым показывает ошибку?
- Какой GatewayClass/controller обслуживает Gateway?
- К какому listener пытается прикрепиться Route?
- Почему attachment принят или отклонён?
- Разрешены ли backend references?
- Есть ли ready endpoints у Service?
- Кто владелец исправления: platform, network или application team?
- Какое минимальное изменение безопасно?
- Какими независимыми проверками доказан результат?

## 11. Официальные материалы

- [Kubernetes Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)
- [Gateway API: API Overview](https://gateway-api.sigs.k8s.io/docs/concepts/api-overview/)
- [Gateway API: Introduction](https://gateway-api.sigs.k8s.io/docs/introduction/)
- [Envoy Gateway installation](https://gateway.envoyproxy.io/docs/install/)
