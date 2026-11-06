# Откуда Kubernetes берет образ Nginx?

В манифесте мы пишем:
`image: nginx:alpine`

Kubernetes понимает это как:
`docker.io/library/nginx:alpine`

- **docker.io** — реестр по умолчанию (Docker Hub).
- **library** — аккаунт по умолчанию для официальных образов.
- **nginx** — имя репозитория.
- **alpine** — тег (версия).

## Аналогия:

Если ты напишешь `mycompany/my-app:v1`, Kubernetes пойдет в `docker.io/mycompany/my-app:v1`. Если у тебя приватный реестр (например, `registry.mycompany.com/app:v1`), нужно будет указать `imagePullSecrets` с логином и паролем [ci# Откуда Kubernetes берет образ Nginx?

В манифесте мы пишем:
`image: nginx:alpine`

Kubernetes понимает это как:
`docker.io/library/nginx:alpine`

- **docker.io** — реестр по умолчанию (Docker Hub).
- **library** — аккаунт по умолчанию для официальных образов.
- **nginx** — имя репозитория.
- **alpine** — тег (версия).

## Как происходит скачивание (под капотом):

1. **Kubelet** на ноде получает задачу запустить Pod.
2. Kubelet **не скачивает образ сам**. Он вызывает **Container Runtime** (containerd, CRI-O, Docker) через интерфейс **CRI** (Container Runtime Interface) [citation:5].
3. Container Runtime берет имя `nginx:alpine`, понимает, что реестр не указан, и идет в `index.docker.io` (Docker Hub) [citation:1].
4. Если реестр приватный, Kubelet передает Runtime секреты из `imagePullSecrets` [citation:3].
5. Runtime скачивает образ и запускает контейнер.

## Аналогия:

Если ты напишешь `mycompany/my-app:v1`, Kubernetes пойдет в `docker.io/mycompany/my-app:v1`. Если у тебя приватный реестр (`registry.mycompany.com/app:v1`), нужно указать `imagePullSecrets` с логином и паролем.tation:8].

## Связанные заметки:

- Как поды находят друг друга: [[why-service]]
