# Pulumi: локальный kind-кластер (TypeScript)

Pulumi создаёт локальный kind-кластер, вызывая установленную `kind` через провайдер Pulumi Command. Docker должен быть запущен. Учебные приложения и Kubernetes-манифесты не применяются.

## Что понадобится

- Запущенный Docker
- kind
- Node.js и npm
- Pulumi CLI

## Запуск (из этой папки)

```bash
npm install
pulumi stack init dev
pulumi config set clusterName k8s-lab
pulumi up
```

Pulumi покажет предварительный план изменений. Проверь его перед подтверждением. Затем проверь кластер:

```bash
kubectl --kubeconfig ../../setup/.kube/kubeconfig get nodes -o wide
kubectl --kubeconfig ../../setup/.kube/kubeconfig get pods -A
```

## Удаление кластера

```bash
pulumi destroy
```

## Важно

- Используется отдельный kubeconfig, основной конфиг kubectl не заменяется.
- Учебные приложения автоматически не устанавливаются.
- State Pulumi хранится локально — не добавляй его в Git.