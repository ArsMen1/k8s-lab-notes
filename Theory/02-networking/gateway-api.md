# Gateway API: модель ресурсов и диагностика для Production Support

Gateway API — расширяемый набор Kubernetes API для L4/L7-маршрутизации. Для HTTP ingress основной стабильный набор включает `GatewayClass`, `Gateway` и `HTTPRoute`. Это не встроенный reverse proxy: CRD должны быть установлены, а совместимый controller должен наблюдать ресурсы и реализовывать их состояние.

> Gateway API — отдельный API add-on. Наличие Kubernetes и Ingress Controller само по себе не означает, что Gateway API CRD или Gateway controller установлены.

## 1. Модель и ответственность

| Ресурс | Scope | Ответственность | Что проверять |
|---|---|---|---|
| `GatewayClass` | Cluster | Указывает `spec.controllerName` и класс реализации | Controller существует, распознаёт класс; `Accepted=True` |
| `Gateway` | Namespace | Запрашивает dataplane/listeners у выбранного класса | `Accepted=True`, `Programmed=True`, listener conditions, address |
| `HTTPRoute` | Namespace | Описывает host/path/header matches и backendRefs | `Accepted=True`, `ResolvedRefs=True), parent status |
| `Service` | Namespace | Логический backend приложения | Service port, selector, EndpointSlice, готовность Pod |

Путь запроса: client → DNS/address Gateway → listener → HTTPRoute match → backendRef Service:port → EndpointSlice → Pod. Успех на одном звене не доказывает исправность следующего.

## 2. GatewayClass и controller prerequisite

`GatewayClass` — cluster-scoped ресурс. Его `spec.controllerName` — идентификатор реализации, а не произвольное имя, которое следует угадывать. Один controller может обслуживать несколько классов; конкретные возможности и конфигурация зависят от реализации.

Перед диагностикой установи, какой controller выбран организацией. В качестве конкретной реализации для учебного стенда можно использовать **Envoy Gateway**, но его установка, версии, параметры и дополнительные CRD должны соответствовать официальному install guide именно выбранного релиза. Не смешивай инструкции Envoy Gateway, Istio, Kong, NGINX Gateway Fabric и cloud Gateway controller: их controllerName, prerequisites, адресация и поддерживаемые features различаются.

Read-only проверки:

```bash
kubectl get crd gateways.gateway.networking.k8s.io
kubectl get crd gatewayclasses.gateway.networking.k8s.io
kubectl get crd httproutes.gateway.networking.k8s.io
kubectl get gatewayclass -o wide
kubectl get gatewayclass <class-name> -o yaml
kubectl get pods,deployments -A | grep -Ei 'envoy|gateway|istio|kong|nginx'
```

Отсутствие CRD означает, что API не установлен (или установлена неполная/иная версия CRD). Наличие CRD без controller не создаёт dataplane. Не устанавливай CRD/controller самостоятельно в shared или production-кластере.

## 3. Gateway, listeners и route attachment

Gateway ссылается ровно на один `gatewayClassName`. Каждый listener задаёт имя секции, protocol, port и при необходимости hostname/TLS. Listener также определяет, какие Routes могут присоединяться через `allowedRoutes`.

Важные правила:

- По умолчанию Route обычно может присоединиться только из namespace самого Gateway; cross-namespace attachment должен быть явно разрешён listener.
- `allowedRoutes.namespaces.from` может быть `Same`, `All` или `Selector`; для Selector проверь labels namespace и selector.
- `allowedRoutes.kinds` ограничивает типы Route.
- Hostname Route должен пересекаться с hostname listener, если hostname задан.
- `HTTPRoute.spec.parentRefs` должен ссылаться на правильный Gateway. `sectionName` ограничивает attachment конкретным listener; проверь точное совпадение имени.
- Attachment — двустороннее согласование: Route запрашивает родителя, а listener разрешает тип/namespace/hostname Route. Одного корректного parentRef недостаточно.

Проверки:

```bash
kubectl get gateway -A -o wide
kubectl describe gateway <gateway> -n <namespace>
kubectl get gateway <gateway> -n <namespace> -o yaml
kubectl get httproute -A -o wide
kubectl describe httproute <route> -n <namespace>
kubectl get namespace --show-labels
```

Не публикуй выводы с секретами. При просмотре полного YAML Gateway проверь, не содержит ли он TLS references или implementation-specific чувствительные параметры.

## 4. HTTPRoute и backendRefs

HTTPRoute связывает listener/Gateway с HTTP-правилами. Проверяй:

- `parentRefs`: name, namespace и sectionName;
- `hostnames`: соответствие DNS/Host header и listener hostname;
- `rules.matches`: PathPrefix/Exact/RegularExpression (поддержка и семантика зависят от API feature/conformance);
- `backendRefs.name` и `port`: это имя Service и **Service port**, не containerPort и не targetPort;
- backend Service находится в namespace Route, если не используется разрешённая cross-namespace ссылка;
- весовые backendRefs и filters не создают непреднамеренную маршрутизацию.

Для backendRef в другом namespace нужен соответствующий `ReferenceGrant` в namespace целевого ресурса. Не расширяй grant до всех ресурсов/namespace без необходимости. Если ссылка не разрешена, смотри `ResolvedRefs` и reason/message, а не начинай с изменения Service.

```bash
kubectl get svc <service> -n <namespace> -o yaml
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service> -o wide
kubectl describe svc <service> -n <namespace>
kubectl get pods -n <namespace> -l '<selector>' -o wide
```

## 5. Conditions: читать status, а не только spec

Gateway API использует стандартные Conditions. Чаще всего в расследовании нужны:

| Объект | Condition | Практический смысл |
|---|---|---|
| GatewayClass | `Accepted` | Controller принял/обрабатывает класс |
| Gateway | `Accepted` | Конфигурация Gateway принята |
| Gateway | `Programmed` | Dataplane сконфигурирован |
| Listener | `Accepted`, `Programmed`, `ResolvedRefs` | Listener принят, запрограммирован, ссылки разрешены |
| HTTPRoute parent status | `Accepted` | Route принят конкретным parent/listener |
| HTTPRoute parent status | `ResolvedRefs` | Ссылки Route (включая backendRefs) разрешены |

Интерпретируй пару `type/status/reason/message`, `observedGeneration` и время transition. `Accepted=True` не гарантирует, что backend отвечает; `Programmed=True` не гарантирует, что приложение Ready. У HTTPRoute status находится в `status.parents[]`, поэтому важно смотреть именно запись нужного Gateway/listener.

```bash
kubectl get gatewayclass <class> -o yaml
kubectl get gateway <gateway> -n <namespace> -o yaml
kubectl get httproute <route> -n <namespace> -o yaml
kubectl get events -A --sort-by=.lastTimestamp
```

## 6. Диагностика HTTP 404 и 503

| Симптом | Вероятные причины | Подтверждение |
|---|---|---|
| 404 от Gateway | Нет подходящего Route; Route не attached; hostname/path mismatch; неверный listener/sectionName; controller-specific default route | Route parent conditions, listener hostname/protocol, Host header/path, controller logs |
| 404 от приложения | Gateway route сработал, но backend вернул 404; path rewrite/префикс или приложение ожидает другой URL | Access logs/trace приложения, прямой запрос к Service в тестовой среде |
| 503 от Gateway | Нет healthy backend endpoints; Service port неверен; backendRef не разрешён; backend timeout/connection failure; controller dataplane не запрограммирован | `ResolvedRefs`, Service port, EndpointSlice, Pod readiness, controller logs |
| 503 при пустом EndpointSlice | Selector не совпадает, Pod не Ready, rollout/scale/termination | Service selector, Pod labels/conditions, EndpointSlice |
| Gateway без address / Programmed=False | Controller отсутствует/не управляет классом, инфраструктура не выдала address, listener conflict или конфигурация отклонена | GatewayClass controllerName/conditions, Gateway conditions, events и документация реализации |

Код 404/503 сам по себе не является доказательством конкретной причины: точный формат ответа и логирование зависят от Gateway controller и приложения.

## 7. Минимальный read-only triage

Сначала убедись, что выбран правильный context. Эти команды читают состояние; не используй `apply`, `patch`, `edit`, `delete`, rollout restart или команды установки во время первичного triage.

```bash
kubectl config current-context
kubectl get crd | grep gateway.networking.k8s.io
kubectl get gatewayclass -o wide
kubectl get gateway -A -o wide
kubectl get httproute -A -o wide
kubectl get svc,endpointslices,pods -n <app-namespace> -o wide
kubectl get events -n <namespace> --sort-by=.lastTimestamp
```

Если нужны логи, сначала найди точный controller namespace/deployment и используй ограниченный временной диапазон/объём:

```bash
kubectl logs -n <controller-namespace> deploy/<controller-deployment> --since=15m --tail=200
```

Не выгружай Secrets, токены, private keys или полный kubeconfig в тикеты.

## 8. Безопасное исправление и verification

Изменения выполняет владелец ресурса через change process после подтверждения root cause:

1. Зафиксируй исходный context, namespace, object generation, conditions, Events и impact.
2. Определи владельца: GatewayClass/controller — platform team; Gateway/listener — cluster/network operator; HTTPRoute/backend — application team (границы зависят от организации).
3. Исправляй минимальную причину: неверный parentRef/sectionName/hostname, разрешённый namespace selector, Service port, selector или ReferenceGrant. Не открывай `allowedRoutes: All` и не выдавай широкие ReferenceGrant как быстрый обход.
4. После согласованного изменения проверь свежие `observedGeneration`, `Accepted`, `ResolvedRefs`, `Programmed`, address/listener status, EndpointSlice и безопасный HTTP smoke test из разрешённой точки.
5. Сравни response code, Host/path, latency и backend logs; убедись, что не нарушены соседние Routes.

## 9. Prerequisites и границы переносимости

- Kubernetes cluster с установленными CRD Gateway API совместимой версии.
- Один конкретный Gateway controller, поддерживающий нужные API versions/features; controller должен быть установлен и Ready.
- Controller-specific GatewayClass и его точный `controllerName`.
- Сетевой способ публикации Gateway address (LoadBalancer, NodePort/host network или другой вариант) — определяется реализацией и средой.
- Для cross-namespace references — соответствующие разрешения Gateway attachment и ReferenceGrant.
- Для TLS — listener TLS configuration и Secret/reference в разрешённом namespace; сверяй ограничения конкретного controller.

Эта теория не предполагает, что Envoy Gateway уже установлен, и не содержит универсальной команды установки: установка controller меняет кластер и должна выполняться отдельно в выделенной лаборатории.

## 10. Связанные материалы

- [Ingress и LoadBalancer](ingress-and-loadbalancer.md)
- [Service types](service-types.md)
- [Network traffic path](network-traffic-path.md)
- [Gateway API troubleshooting lab](../../labs/troubleshooting/gateway-api-404-503.md)

## Официальная документация

- [Kubernetes: Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)
- [Gateway API: API Overview](https://gateway-api.sigs.k8s.io/docs/concepts/api-overview/)
- [Gateway API: Introduction](https://gateway-api.sigs.k8s.io/docs/introduction/)
- [Gateway API: API specification](https://gateway-api.sigs.k8s.io/reference/api-spec/)
- [Envoy Gateway: Installation](https://gateway.envoyproxy.io/docs/install/)
