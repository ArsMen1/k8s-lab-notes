# Внешний HTTP(S)-трафик: Ingress и Gateway API

Ingress — стабильный API Kubernetes для описания HTTP/HTTPS-маршрутов от внешнего клиента к Service. Сам объект Ingress не является прокси и не открывает порт: в кластере должен работать совместимый Ingress Controller, который наблюдает Ingress и реализует его правила.

> Важно: Ingress API заморожен — он остаётся стабильным и не планируется к удалению, но новые возможности в него не добавляют. Kubernetes рекомендует рассматривать Gateway API для новых сценариев с более сложной маршрутизацией.

## 1. Service LoadBalancer и Ingress решают разные задачи

- Service типа LoadBalancer предоставляет внешний L4-балансировщик для конкретного Service, если в среде есть cloud-controller или другая реализация (например, MetalLB).
- Ingress описывает HTTP/HTTPS маршруты по host и path и направляет запросы на backend Service. Один внешний адрес может обслуживать несколько приложений, но это зависит от controller и его инфраструктуры.
- Ingress не предназначен для произвольного TCP/UDP трафика. Для таких протоколов используй подходящую реализацию Service/балансировщика.

## 2. Из чего состоит путь запроса

1. DNS-имя приложения указывает на внешний адрес Ingress Controller.
2. Controller принимает соединение и выбирает IngressClass/правила.
3. Правило сопоставляет Host и path.
4. Controller направляет запрос в backend Service.
5. Service отправляет трафик на готовые Pod endpoints.

Ingress и backend Service обычно находятся в одном namespace. TLS Secret, на который ссылается Ingress, также должен быть в namespace самого Ingress.

## 3. Что проверить в минимальной конфигурации

- Ingress Controller действительно установлен и Ready.
- IngressClass существует; в манифесте задано spec.ingressClassName.
- Используется apiVersion networking.k8s.io/v1.
- У каждого HTTP path задан pathType (например, Prefix).
- Backend Service и его port существуют в том же namespace.
- У Service есть ready endpoints.
- Для TLS указаны правильные hosts и Secret типа kubernetes.io/tls с ключами tls.crt и tls.key.
- Особенности annotations и TLS проверены по документации именно выбранного controller.

## 4. Диагностика 404 / 502 / TLS error

    kubectl get ingressclass
    kubectl get ingress -A -o wide
    kubectl describe ingress <name> -n <namespace>
    kubectl get svc,endpointslices -n <namespace>
    kubectl describe secret <tls-secret> -n <namespace>
    kubectl get pods,svc -A | grep -i ingress

Интерпретация зависит от controller, но типовые направления такие:

| Симптом | Что проверить |
|---|---|
| 404 | Host header, path/pathType, ingressClassName, controller logs |
| 502/503 | backend Service/port, ready endpoints, приложение, controller logs |
| Нет ADDRESS / Pending | Service/LoadBalancer controller и инфраструктуру выдачи адреса |
| TLS error | Secret в namespace Ingress, ключи, срок действия, SAN и соответствие host |

Не считай наличие объекта Ingress доказательством доступности приложения. Проверяй весь маршрут от внешнего адреса до Pod.

## 5. Практика и следующие темы

End-to-end упражнение с backend, Service, Ingress и self-signed TLS находится в [Ingress manifests](../../Manifests/ingress/README.md), а порядок диагностики — в [P1 labs](../../labs/fundamentals-p1/README.md). Ingress Controller и IngressClass должны быть заранее установлены в тестовом кластере: универсальный controller manifest нельзя считать переносимым между всеми дистрибутивами.

Следующие темы:
- [Service types](service-types.md)
- [Network traffic path](network-traffic-path.md)
- [Service discovery](where-are-endpoints-stored.md)

Официальная документация:
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Ingress Controllers](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/)
- [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/)

## Продолжение: Gateway API

Для новой модели маршрутизации смотри [Gateway API: модель ресурсов и диагностика](gateway-api.md) и [практическую лабораторию 404/503](../../labs/troubleshooting/gateway-api-404-503.md). Ingress остаётся стабильным API; Gateway API — отдельный набор CRD, которому необходим совместимый controller.
