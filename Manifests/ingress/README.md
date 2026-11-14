# Ingress + TLS end-to-end lab

Это backend + Service + Ingress манифесты и локальный self-signed TLS. Для маршрутизации требуется уже установленный Ingress Controller и соответствующий IngressClass. Контроллеры зависят от дистрибутива и инфраструктуры, поэтому здесь не закреплён один vendor controller и не заявляется его установка.

## Prerequisites

Для Minikube один конкретный вариант controller: `minikube addons enable ingress`, затем дождись Pod в namespace ingress-nginx и проверь `kubectl get ingressclass`. У Minikube должен быть доступен адрес `minikube ip`. Для других кластеров установи совместимый controller по официальной инструкции его проекта.

    kubectl get ingressclass
    kubectl get nodes
    kubectl config current-context

Выбери существующий IngressClass и впиши его имя в ingress.yaml. Убедись, что controller доступен из среды, где будешь выполнять curl. Если контроллера нет, установи выбранную реализацию по её официальной инструкции в disposable cluster.

## Apply backend

    kubectl apply -f Manifests/ingress/namespace.yaml
    kubectl apply -f Manifests/ingress/deployment.yaml
    kubectl apply -f Manifests/ingress/service.yaml
    kubectl rollout status deployment/web -n lab-p1-ingress

## Create test certificate

Не коммить private key. Создай self-signed сертификат локально:

    openssl req -x509 -nodes -days 2 -newkey rsa:2048 -keyout /tmp/lab-p1.key -out /tmp/lab-p1.crt -subj "/CN=app.lab.test" -addext "subjectAltName=DNS:app.lab.test"
    kubectl create secret tls app-tls -n lab-p1-ingress --cert=/tmp/lab-p1.crt --key=/tmp/lab-p1.key

Затем примени Ingress:

    kubectl apply -f Manifests/ingress/ingress.yaml
    kubectl get ingress -n lab-p1-ingress -o wide
    kubectl describe ingress web -n lab-p1-ingress

Проверка зависит от адреса controller. Для локального теста добавь app.lab.test в hosts/используй curl --resolve:

    curl -k --resolve app.lab.test:443:<controller-address> https://app.lab.test/

-k допустим только для self-signed учебного сертификата, не как production настройка. Проверь сертификат отдельно через openssl s_client.

## RCA

404: Host/path/class/controller rules. 502/503: Service port, ready endpoints, app listen port и controller logs. TLS error: Secret type/namespace, SAN, expiry, certificate-key pair.

Удаляй только lab-p1-ingress ресурсы после проверки, что namespace не используется другими упражнениями. Удали локальные key/cert из /tmp после занятия.
