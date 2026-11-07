# K8s Lab Notes

Репозиторий для изучения Kubernetes (low-level) и ведения конспекта в Obsidian.

Главный трек обучения: [`Theory/Overview/learning-path.md`](Theory/Overview/learning-path.md)

## Структура

* `Theory/` — теоретические заметки (Markdown, вики-ссылки Obsidian).
* `Manifests/` — YAML для практики (`kubectl apply`).

## Быстрый старт (Killercoda / любой кластер)

```bash
git clone https://github.com/ArsMen1/k8s-lab-notes.git
cd k8s-lab-notes

kubectl apply -f Manifests/base-deployment/prod-app.yaml \
  -f Manifests/config-server/config-server.yaml \
  -f Manifests/service-and-dns/service.yaml \
  -f Manifests/service-and-dns/service-nodeport.yaml \
  -f Manifests/service-and-dns/service-config-server.yaml

kubectl get deploy,rs,pods,svc,EndpointSlice
```

Дальше по этапам:

```bash
# Этап 1 — сеть наружу в лабе
kubectl apply -f Manifests/service-and-dns/service-nodeport.yaml

# Этап 2 — probes / config / namespace
kubectl apply -f Manifests/probes/payments-api-with-probes.yaml
kubectl apply -f Manifests/config/payments-config.yaml
kubectl apply -f Manifests/namespaces/lab-namespace.yaml
```

## Карта заметок

### Overview
* [`what-is-kubernetes`](Theory/Overview/what-is-kubernetes.md)
* [`glossary-core-objects`](Theory/Overview/glossary-core-objects.md)
* [`learning-path`](Theory/Overview/learning-path.md) ← **с чего продолжать**

### Architecture & networking
* Deployment vs ReplicaSet, Service, Endpoints, DaemonSet, Labels
* Типы Service: ClusterIP / NodePort / LoadBalancer

### Workloads & config
* Health probes, rolling update, ConfigMap/Secret, Namespaces

### Operations / kubectl
* [`kubectl-debug`](Theory/operations/kubectl-debug.md) — алгоритм отладки
* [`cheatsheet`](Theory/kubectl/cheatsheet.md) · [`how-kubectl-works`](Theory/kubectl/how-kubectl-works.md)

## Как вести конспект

1. Одна тема = одна заметка.
2. В конце — 3–5 строк «что увидел в кластере».
3. Ссылки между заметками через `[[wiki-links]]`.
4. В Git только желаемое состояние; Endpoints/статусы подов не коммитить.
