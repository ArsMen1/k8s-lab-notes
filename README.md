# K8s Lab Notes

Репозиторий для изучения Kubernetes (low-level) и ведения конспекта.

## Структура
* `theory/` — теоретические заметки (Markdown).
* `manifests/` — YAML-манифесты для практики (применяются через `kubectl apply`).

## Быстрый старт (в Killercoda)
```bash
git clone https://github.com/ваш-username/k8s-lab-notes.git
cd k8s-lab-notes
kubectl apply -f manifests/base-deployment/prod-app.yaml