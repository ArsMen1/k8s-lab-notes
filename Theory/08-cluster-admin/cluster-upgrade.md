# Обновление Kubernetes-кластера (Cluster Upgrade)

Обновление Kubernetes — управляемая операция с предварительной проверкой совместимости, резервным копированием и поэтапным обновлением control plane и worker nodes. Само по себе обновление не гарантирует Zero Downtime: доступность зависит от реплик, readiness probes, PDB, topology spread, capacity и приложения.

## 1. Version Skew: что проверить

Правила совместимости зависят от версии Kubernetes. Перед обновлением сверяйся с официальной Version Skew Policy для целевой версии.

Основные ориентиры для современных поддерживаемых версий:

- kubelet не должен быть новее kube-apiserver и имеет ограничение на число minor-версий отставания; для актуальной политики начиная с Kubernetes 1.28 это до 3 minor versions.
- kubectl поддерживает версию API Server в пределах одной minor-версии старше или младше.
- kube-controller-manager и kube-scheduler должны соответствовать правилам skew относительно kube-apiserver; при HA обновляются последовательно.
- kubeadm сначала обновляют до целевой minor-версии, затем выполняют upgrade plan/apply.

Не воспринимай «API Server всегда самый новый» как разрешение смешивать любые версии: допустимые сочетания определяются официальной таблицей для конкретного релиза.

## 2. Подготовка

До начала работ:

1. Определи текущую и целевую версии, проверь поддерживаемый путь обновления. Обычно переход выполняется по одному minor-релизу за раз.
2. Прочитай release notes и проверь удалённые/изменённые API через инструменты вроде `kubent` или `pluto`.
3. Проверь здоровье control plane, etcd, нод и критичных workloads.
4. Проверь capacity для пересоздания Pod, PDB, anti-affinity/topology spread и локальные тома.
5. Сделай etcd snapshot и проверь процедуру восстановления.
6. Согласуй maintenance window и план отката. Для kubeadm нет универсального безопасного downgrade одной командой.

## 3. Обновление control plane через kubeadm (пример Debian/Ubuntu)

Команды ниже — схема для перехода на конкретную поддерживаемую версию; замени `1.xx.x` на точный доступный patch release и используй репозиторий Kubernetes, настроенный по официальной инструкции для этой ветки.

На первой control-plane ноде:

```bash
sudo apt-mark unhold kubeadm
sudo apt-get update
sudo apt-get install -y kubeadm='1.xx.x-*'
sudo apt-mark hold kubeadm

sudo kubeadm version
sudo kubeadm upgrade plan
sudo kubeadm upgrade apply v1.xx.x
```

Затем обнови kubelet и kubectl на этой ноде:

```bash
kubectl drain <control-plane-node> --ignore-daemonsets
sudo apt-mark unhold kubelet kubectl
sudo apt-get update
sudo apt-get install -y kubelet='1.xx.x-*' kubectl='1.xx.x-*'
sudo apt-mark hold kubelet kubectl
sudo systemctl daemon-reload
sudo systemctl restart kubelet
kubectl uncordon <control-plane-node>
```

В single-control-plane кластере drain временно лишает кластер доступного control plane для обычных API операций. Планируй это как обслуживание, а не как zero-downtime процедуру. Static Pods control plane не выселяются как обычные workload Pods.

Для дополнительных control-plane узлов используй предусмотренную kubeadm процедуру `kubeadm upgrade node`, обновляй узлы по одному и соблюдай HA quorum/доступность API. Не запускай `upgrade apply` на каждой ноде.

## 4. Обновление worker nodes по одной

На worker node сначала обнови kubeadm и локальную kubelet configuration:

```bash
sudo apt-mark unhold kubeadm
sudo apt-get update
sudo apt-get install -y kubeadm='1.xx.x-*'
sudo apt-mark hold kubeadm
sudo kubeadm upgrade node
```

Затем с control plane выполни drain worker перед обновлением kubelet:

```bash
kubectl drain <worker-node> --ignore-daemonsets
```

После успешного drain обнови kubelet и kubectl (если kubectl установлен на worker):

```bash
sudo apt-mark unhold kubelet kubectl
sudo apt-get update
sudo apt-get install -y kubelet='1.xx.x-*' kubectl='1.xx.x-*'
sudo apt-mark hold kubelet kubectl
sudo systemctl daemon-reload
sudo systemctl restart kubelet
```

Верни ноду в scheduling:

```bash
kubectl uncordon <worker-node>
kubectl get nodes -o wide
```

Перед переходом к следующей ноде дождись Ready и проверь workloads. Если drain заблокирован PDB — выясни, почему нельзя безопасно выселить Pod; не обходи eviction protection автоматически.

## 5. Managed Kubernetes

В managed-сервисах провайдер обычно управляет control plane, а worker node pools обновляются отдельно. Конкретные стратегии различаются: in-place, surge, blue/green или замена node pool. Не предполагай, что каждый провайдер использует один и тот же механизм.

Проверь:
- совместимость версии control plane и node pools;
- поддерживаемые версии CNI, CSI, CoreDNS и других add-ons;
- доступную capacity и лимиты IP;
- PDB и autoscaler;
- план замены/отката node pool.

## 6. Проверки после обновления

```bash
kubectl get nodes -o wide
kubectl get pods -A
kubectl get events -A --sort-by=.metadata.creationTimestamp
kubectl get --raw='/readyz?verbose'
```

Проверь состояние критичных приложений, ingress, DNS, storage, CNI и мониторинга. Сверь версии kubelet, API Server и add-ons с целевым baseline.

## Связанные заметки

- [[kubeadm-bootstrap]]
- [[managed-vs-self-hosted]]
- [[pod-disruption-budget]]
- [[health-probes]]
- [[rolling-update]]
