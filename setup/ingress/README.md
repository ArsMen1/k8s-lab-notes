# Локальный Ingress + TLS на kind

Сценарий использует локальный kind-кластер из `setup/kind-config.yaml` и Traefik как Ingress Controller. Порты компьютера `80/443` направляются на NodePort `30081/30443`. Существующий доступ через `localhost:8080` → NodePort `30080` сохранён (например, для учебного payments-api).

> Все команды ниже предназначены только для локального учебного кластера `k8s-lab`. Перед выполнением проверь текущий kubectl context. Не выполняй команды на рабочем или shared-кластере.

## Prerequisites

- Docker Engine / Docker Desktop запущен
- kind, kubectl, Helm 3, OpenSSL
- Репозиторий клонирован локально

Из корня репозитория проверь контекст и узлы:

```bash
kubectl config current-context
kubectl get nodes -o wide
```

Контекст должен быть локальным `kind-k8s-lab`. Если кластер ещё не создан, смотри [инструкцию setup](../README.md). Конфигурация kind с hostPort 80/443 применяется только при создании кластера: если кластер `k8s-lab` уже существует со старой конфигурацией, его нужно пересоздать для получения новых port mappings. **Удаление кластера уничтожит все данные и ресурсы внутри него.** Убедись, что там нет ничего ценного, прежде чем пересоздавать.

## 1. Установить Traefik

Используем официальный Helm chart Traefik, зафиксированный на версии `42.4.1` для воспроизводимости. Он устанавливает IngressClass `traefik` и Kubernetes Ingress provider.

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update

helm upgrade --install traefik traefik/traefik \
  --version 42.4.1 \
  --namespace traefik \
  --create-namespace \
  --values setup/ingress/traefik-values.yaml \
  --wait \
  --timeout 5m
```

Проверь, что контроллер готов, Service получил NodePort, а IngressClass существует:

```bash
kubectl rollout status deployment/traefik -n traefik
kubectl get pods,svc -n traefik -o wide
kubectl get ingressclass
```

Ожидаемые NodePort: HTTP `30081`, HTTPS `30443`. Host mappings kind перенаправляют их на `localhost:80` и `localhost:443`.

## 2. Создать backend

Разверни учебный backend из каталога Ingress. Namespace создаётся отдельно — это гарантирует порядок ресурсов.

```bash
kubectl apply -f Manifests/ingress/namespace.yaml
kubectl apply -f Manifests/ingress/deployment.yaml
kubectl apply -f Manifests/ingress/service.yaml

kubectl rollout status deployment/web -n lab-p1-ingress
kubectl get pods,svc -n lab-p1-ingress -o wide
kubectl get endpointslice -n lab-p1-ingress
```

## 3. Создать временный self-signed сертификат

Сертификат и приватный ключ создаются локально, вне репозитория. SAN должен содержать DNS-имя `app.lab.test`, иначе современные клиенты могут не принять сертификат даже при совпадении CN.

```bash
mkdir -p .local-tls
openssl req -x509 -nodes -days 2 -newkey rsa:2048 \
  -keyout .local-tls/app.lab.test.key \
  -out .local-tls/app.lab.test.crt \
  -subj "/CN=app.lab.test" \
  -addext "subjectAltName=DNS:app.lab.test"

kubectl create secret tls app-tls \
  -n lab-p1-ingress \
  --cert=.local-tls/app.lab.test.crt \
  --key=.local-tls/app.lab.test.key
```

Не добавляй приватный ключ, сертификат или Secret в Git.

## 4. Создать Ingress

Ingress в этом примере использует IngressClass `traefik` и TLS Secret `app-tls` из того же namespace, что и backend.

```bash
kubectl apply -f Manifests/ingress/ingress.yaml
kubectl get ingress -n lab-p1-ingress -o wide
kubectl describe ingress web -n lab-p1-ingress
```

## 5. Проверить HTTP и HTTPS

Проверка HTTP через Host header (не требует изменения hosts-файла):

```bash
curl --resolve app.lab.test:80:127.0.0.1 http://app.lab.test/
```

Ожидается ответ nginx. HTTPS:

```bash
curl --resolve app.lab.test:443:127.0.0.1 -k https://app.lab.test/
```

Флаг `-k` отключает проверку доверия сертификату; используй его только для этого self-signed учебного примера. TLS handshake и SAN можно посмотреть отдельно:

```bash
openssl s_client -connect 127.0.0.1:443 -servername app.lab.test </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

Если хочешь открыть сайт в браузере, добавь `127.0.0.1 app.lab.test` в локальный hosts-файл и перейди на `https://app.lab.test`. Браузер будет предупреждать о self-signed сертификате — это ожидаемо.

## Диагностика

| Симптом | Что проверить |
|---|---|
| Connection refused на 80/443 | kind port mappings, NodePort, Traefik Service, Pod readiness |
| 404 | IngressClass, Host, path, ingress controller logs |
| 502/503 | Service port, EndpointSlice, backend readiness и приложение |
| TLS error | Secret существует в namespace Ingress, type `kubernetes.io/tls`, совпадают key/cert, SAN и срок действия |
| Ingress не подхвачен | `kubectl describe ingress`, `kubectl get ingressclass`, Traefik logs |

Безопасные команды диагностики (только чтение):

```bash
kubectl get ingress -n lab-p1-ingress -o yaml
kubectl get ingressclass
kubectl get svc -n traefik
kubectl get pods -n traefik -o wide
kubectl logs deployment/traefik -n traefik --tail=100
kubectl get endpointslice -n lab-p1-ingress
```

## Cleanup

Удаляй только ресурсы этого упражнения. Сначала удаляется Ingress, затем backend namespace и Traefik release:

```bash
kubectl delete -f Manifests/ingress/ingress.yaml
kubectl delete namespace lab-p1-ingress
helm uninstall traefik -n traefik
kubectl delete namespace traefik
rm -rf .local-tls
```

Команды удаления необратимы для соответствующих ресурсов. Удаление namespace `lab-p1-ingress` удаляет все ресурсы в этом namespace; namespace `traefik` — контроллер и его ресурсы.

## References

- [Traefik official Helm chart](https://github.com/traefik/traefik-helm-chart)
- [Traefik Kubernetes Ingress provider](https://doc.traefik.io/traefik/routing/providers/kubernetes-ingress/)
- [kind configuration and extraPortMappings](https://kind.sigs.k8s.io/docs/user/configuration/)
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Kubernetes TLS Secrets](https://kubernetes.io/docs/concepts/configuration/secret/#tls-secrets)
