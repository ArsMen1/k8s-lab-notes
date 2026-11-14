# Managed Kubernetes vs Self-Hosted

Выбор способа развертывания Kubernetes — это распределение ответственности между командой и провайдером. Managed не означает «провайдер отвечает за всё», а self-hosted не обязательно означает ручную установку каждого компонента.

## Разделение ответственности

| Область | Managed Kubernetes | Self-hosted |
|---|---|---|
| Control plane | Провайдер обслуживает API Server и control-plane-компоненты; детали HA и SLA зависят от продукта | Команда проектирует, разворачивает, обновляет и восстанавливает control plane |
| etcd | Обычно управляется провайдером; доступ к snapshot/restore зависит от сервиса | Команда отвечает за quorum, диски, backup и restore |
| Worker nodes | Node pools могут управляться провайдером, но ОС, capacity и обновления часто остаются задачей клиента | Команда отвечает за ОС, runtime, kubelet, capacity и обновления |
| CNI / CSI / LoadBalancer | Может быть интегрировано с облаком, но add-ons и их версии требуют управления | Команда выбирает, устанавливает и обслуживает компоненты |
| IAM / сеть / безопасность | Часть интегрирована с облаком; остаются настройки ролей, сетей, политик и workloads | Большая часть проектирования и эксплуатации на команде |

Fargate и Autopilot — не просто «обычные worker nodes»: это модели, в которых провайдер дополнительно абстрагирует управление узлами или размещением Pod. Доступные ограничения и возможности зависят от конкретного сервиса.

## Инструменты

### Managed

- Terraform / OpenTofu — инфраструктура как код: сети, кластеры, node pools, IAM и сопутствующие ресурсы.
- CLI и API провайдера — обновление control plane, node pools и add-ons.
- Helm / GitOps — доставка приложений и платформенных компонентов.

### Self-hosted

- `kubeadm` — bootstrap инструментарий для создания базового кластера.
- Kubespray — Ansible automation для развёртывания и управления кластерами.
- Talos Linux — специализированная ОС для Kubernetes с управлением через API.

## Когда выбирают

### Managed

Подходит, когда важны скорость запуска, снижение операционной нагрузки на control plane и интеграция с облачной инфраструктурой. Но команда всё равно отвечает за приложения, ресурсы, RBAC, network policies, observability, backups приложений и безопасные обновления node pools.

Риски: vendor lock-in, стоимость, ограничения конфигурации control plane и зависимость от SLA/возможностей провайдера.

### Self-hosted

Может быть оправдан на bare metal, в закрытых контурах, при особых требованиях к данным, сети, оборудованию или контролю. Цена — необходимость компетенций по etcd, PKI, ОС, runtime, CNI/CSI, HA и disaster recovery.

Не стоит выбирать self-hosted только ради «полного контроля»: этот контроль сопровождается полной ответственностью за эксплуатацию.

## Что важно для Production Support

При инциденте сначала выясняй, где заканчивается ответственность провайдера и начинается зона команды:

- API Server недоступен — проверяй статус managed control plane и provider status page либо control-plane nodes и etcd в self-hosted.
- Pod не стартует — проверяй workload, scheduler events, kubelet/runtime и node health.
- Service/Ingress недоступен — проверяй CNI, cloud load balancer, ingress controller, DNS и network policy.
- Volume не монтируется — проверяй CSI driver, cloud disk и PVC/PV events.

## Связанные заметки

- [[kubeadm-bootstrap]]
- [[cluster-upgrade]]
- [[pod-disruption-budget]]
- [[what-is-kubernetes]]
