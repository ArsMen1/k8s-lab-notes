# Ingress + TLS end-to-end lab

Это backend + Service + Ingress манифесты и локальный self-signed TLS. Для маршрутизации требуется Ingress Controller и соответствующий IngressClass.

## Local kind: Traefik

Для локального кластера kind из репозитория есть [отдельная полноценная инструкция по Traefik + TLS](../../setup/ingress/README.md): установка pinned Helm chart, host port mappings 80/443, сертификат, проверки HTTP/HTTPS и cleanup. В этом варианте манифест Ingress использует класс `traefik`.

## Other environments

Для Minikube один конкретный вариант controller: `minikube addons enable ingress`, затем дождись Pod в namespace ingress-nginx и проверь `kubectl get ingressclass`. У Minikube должен быть доступен адрес `minikube ip`.

Перед применением в другом кластере проверь существующий IngressClass и измени `spec.ingressClassName` в `ingress.yaml` на имя доступного класса (например, `nginx` для стандартного Minikube addon). Убедись, что controller доступен из среды, где будешь выполнять curl. Если контроллера нет, установи выбранную реализацию по её официальной инструкции в disposable cluster.

## Apply backend

    kubectl apply -f Manifests/ingress/namespace.yaml
    kubectl apply -f Manifests/ingress/deployment.yaml
    kubectl apply -f Manifests/ingress/service.yaml
    kubectl rollout status deployment/web -n lab-p1-ingress

## Create test certificate

Не коммить private key. Создай self-signed сертификат локально:

    openssl req -x509 -nodes -days 2 -newkey rsa:2048 -keyout /tmp/lab-p1.key -out /tmp/lab-p1.crt -subj "/CN=app.lab.test" -addext "subjectAltName=DNS:app.lab.test"
    kubectl create secret tls app-tls -n lab-p1-ingress \
      --cert=/tmp/lab-p1.crt --key=/tmp/lab-p1.key \
      --dry-run=client -o yaml | kubectl apply -f -

Затем примени Ingress:

    kubectl apply -f Manifests/ingress/ingress.yaml
    kubectl get ingress -n lab-p1-ingress -o wide
    kubectl describe ingress web -n lab-p1-ingress

Проверка зависит от адреса controller. Для локального kind сценария смотри отдельную инструкцию; для другого кластера используй его адрес и Host header:

    curl -k --resolve app.lab.test:443:<controller-address> https://app.lab.test/

-k допустим только для self-signed учебного сертификата, не как production настройка. Проверь сертификат отдельно через openssl s_client.

## RCA

404: Host/path/class/controller rules. 502/503: Service port, ready endpoints, app listen port и controller logs. TLS error: Secret type/namespace, SAN, expiry, certificate-key pair.

Удаляй только lab-p1-ingress ресурсы после проверки, что namespace не используется другими упражнениями. Удали локальные key/cert из /tmp после занятия.
