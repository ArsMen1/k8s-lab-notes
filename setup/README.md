# Локальная Kubernetes-лаборатория

Здесь собраны способы поднять учебный Kubernetes-кластер на своём компьютере с помощью [kind](https://kind.sigs.k8s.io/).

> Эти настройки создают кластер из Docker-контейнеров **только локально**. Учебные приложения и манифесты автоматически не устанавливаются. Настройки не предназначены для подключения к удалённым кластерам.

## Что понадобится

- Docker Desktop (Windows/macOS) или Docker Engine (Linux) — запущенный
- [kind](https://kind.sigs.k8s.io/) — инструмент для создания локального Kubernetes
- На выбор: Terraform или Pulumi + Node.js

Создаётся кластер `k8s-lab`: одна control-plane нода и один worker. На control-plane настроены перенаправления: компьютер `8080` → NodePort `30080` для старых NodePort-примеров, а `80/443` → NodePort `30081/30443` для локального Traefik Ingress. Kubeconfig сохраняется отдельно: `setup/.kube/kubeconfig`, поэтому основной kubeconfig не перезаписывается.

## Выбери инструмент

- [Terraform — запуск кластера](terraform/README.md)
- [Pulumi — запуск кластера на TypeScript](pulumi/README.md)
- [Terraform и Pulumi: сравнение](terraform-vs-pulumi.md)

## Запуск вручную через kind

Если хочешь обойти IaC, находясь в каталоге `setup/`:

```bash
kind create cluster --name k8s-lab --config kind-config.yaml --kubeconfig .kube/kubeconfig
```

## Проверка созданного кластера

Bash (из каталога `setup/`):

```bash
export KUBECONFIG="$(pwd)/.kube/kubeconfig"
kubectl config current-context
kubectl get nodes -o wide
kubectl get pods -A
```

PowerShell:

```powershell
$env:KUBECONFIG = "$(Get-Location)/.kube/kubeconfig"
kubectl config current-context
kubectl get nodes -o wide
kubectl get pods -A
```

## Ingress + TLS на локальном kind

Для полноценного локального Ingress с HTTPS, Traefik Controller, host mappings на 80/443, self-signed сертификатом, тестами curl/openssl и cleanup — [отдельная пошаговая лаборатория](ingress/README.md). Она использует отдельные NodePort 30081/30443, чтобы не конфликтовать с существующим payments-api NodePort 30080.

## Удаление

Удаляй кластер командой выбранного инструмента из его инструкции. Либо вручную:

```bash
kind delete cluster --name k8s-lab --kubeconfig .kube/kubeconfig
```

Удаление кластера уничтожит локальные Kubernetes-ресурсы в нём.
> **Windows:** ручной запуск `kind` подходит для PowerShell. Команды IaC в Terraform/Pulumi используют Bash-синтаксис (`mkdir -p`, `$()`), поэтому запускай их из WSL2 с настроенной интеграцией Docker Desktop, а не из native CMD/PowerShell. Этот путь пока не проверен на runtime.
