# Terraform: локальный kind-кластер

Terraform создаёт и удаляет локальный kind-кластер, вызывая установленную утилиту `kind`. Docker должен быть запущен. Учебные Kubernetes-манифесты не применяются.

## Что понадобится

- Запущенный Docker
- kind
- Terraform

## Запуск (из этой папки)

```bash
terraform init
terraform plan
terraform apply
```

Перед подтверждением внимательно посмотри план. После создания проверь ноды и системные Pods:

```bash
kubectl --kubeconfig ../../setup/.kube/kubeconfig get nodes -o wide
kubectl --kubeconfig ../../setup/.kube/kubeconfig get pods -A
```

## Удаление кластера

```bash
terraform destroy
```

## Важно

- Terraform state хранится локально и исключён из Git. Не добавляй его в репозиторий.
- Terraform не запускает `kubectl apply` и не устанавливает учебные приложения.
- Имя кластера и пути заданы в `main.tf`.
- `destroy` удалит kind-кластер, записанный в состоянии Terraform. Не меняй вручную имя между созданием и удалением.