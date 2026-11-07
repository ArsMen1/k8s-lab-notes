# Namespace — виртуальные кластеры внутри одного

## Зачем

Один физический кластер, несколько логических границ:

- `lab` / `dev` / `staging` / `prod`
- команда A и команда B
- системные компоненты (`kube-system`) отдельно от приложений

Namespace ограничивает **имена объектов** и удобно режет RBAC, NetworkPolicy, ResourceQuota.

## Что namespace НЕ делает

- Не изолирует сеть сам по себе (без NetworkPolicy поды из разных ns свободно ходят друг к другу).
- Не делит ноды автоматически.
- Не заменяет отдельные кластеры для жесткой изоляции (competing tenants / разные security boundaries).

## DNS между namespace

Из пода в `lab` к сервису в `default`:

`payments-svc.default.svc.cluster.local`

Короткое имя `payments-svc` ищет только **внутри своего** namespace.

## Системные namespace

- `default` — куда попадают объекты без `metadata.namespace`
- `kube-system` — control plane addons, CoreDNS, CNI
- `kube-public` / `kube-node-lease` — служебные

## Практика в лабе

```bash
kubectl create namespace lab
kubectl apply -f Manifests/namespaces/lab-namespace.yaml
kubectl -n lab get all
kubectl config set-context --current --namespace=lab
```

Практика: `Manifests/namespaces/lab-namespace.yaml`

## Связанные заметки

- Labels как второй способ группировки: [[labels-and-selectors]]
- ConfigMap/Secret живут в конкретном ns: [[configmap-and-secret]]
