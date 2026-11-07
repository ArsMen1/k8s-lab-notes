# Откуда Kubernetes берет образ Nginx?

В манифесте мы пишем:
`image: nginx:alpine`

Kubernetes понимает это как:
`docker.io/library/nginx:alpine`

- **docker.io** — реестр по умолчанию (Docker Hub).
- **library** — аккаунт по умолчанию для официальных образов.
- **nginx** — имя репозитория.
- **alpine** — тег (версия).

## Как происходит скачивание (под капотом)

1. **Kubelet** на ноде получает задачу запустить Pod.
2. Kubelet **не скачивает образ сам**. Он вызывает **Container Runtime** (containerd, CRI-O) через интерфейс **CRI** (Container Runtime Interface).
3. Container Runtime берет имя `nginx:alpine`, понимает, что реестр не указан, и идет в `index.docker.io` (Docker Hub).
4. Если реестр приватный, Kubelet передает Runtime секреты из `imagePullSecrets`.
5. Runtime скачивает образ и запускает контейнер.

## Аналогия

Если ты напишешь `mycompany/my-app:v1`, Kubernetes пойдет в `docker.io/mycompany/my-app:v1`. Если у тебя приватный реестр (`registry.mycompany.com/app:v1`), нужно указать `imagePullSecrets` с логином и паролем.

## Полезные команды

- `kubectl describe pod <имя>` — смотреть `Events` (`Pulling`, `Pulled`, `Failed`).
- `kubectl get events --sort-by=.lastTimestamp` — общая лента событий по namespace.

## Связанные заметки

- Как поды находят друг друга: [[why-service]]
- Как дебажить упавший под: [[kubectl-debug]]
