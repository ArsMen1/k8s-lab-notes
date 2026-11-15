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

`payments-svc.default`

Имя `payments-svc.default` позволяет обратиться к Service в другом namespace. Полный FQDN имеет форму `payments-svc.default.svc.<cluster-domain>`; `cluster.local` — распространённое значение по умолчанию, но домен кластера может отличаться.

## Системные namespace

- `default` — куда попадают объекты без `metadata.namespace`
- `kube-system` — control plane addons, CoreDNS, CNI
- `kube-public` / `kube-node-lease` — служебные

## Практика в лабе

```bash
kubectl apply -f Manifests/echo/namespace.yaml
kubectl apply -f Manifests/echo/
kubectl rollout status deployment/echo -n lab
kubectl -n lab get all
kubectl -n lab exec deploy/echo -- wget -qO- http://echo
kubectl -n lab exec deploy/echo -- wget -qO- http://payments-api.payments
```

Практика: `Manifests/echo/`

## Связанные заметки

- Labels как второй способ группировки: [[labels-and-selectors]]
- ConfigMap/Secret живут в конкретном ns: [[configmap-and-secret]]
