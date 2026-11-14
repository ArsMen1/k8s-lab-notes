# Поднятие Kubernetes-кластера через kubeadm

`kubeadm` выполняет bootstrap и базовую настройку control plane и worker nodes. Он не устанавливает ОС, container runtime или CNI и не заменяет инструменты управления инфраструктурой.

Это учебный обзор для Linux-кластера с containerd. Конкретные команды установки пакетов зависят от дистрибутива и поддерживаемой версии Kubernetes — сверяйся с официальной документацией именно для выбранного minor release.

## 1. Подготовка каждой ноды

До установки Kubernetes подготовь все control-plane и worker узлы:

1. Убедись, что hostname, MAC address и product_uuid уникальны, время синхронизировано, узлы видят друг друга по сети.
2. Установи поддерживаемую версию container runtime (например, containerd) и настрой CRI socket.
3. Настрой cgroup driver. Для systemd-хостов обычно рекомендуется `systemd` и у kubelet, и у containerd.
4. Настрой необходимые kernel modules и sysctl для выбранного CNI. Для многих конфигураций нужны `overlay`, `br_netfilter` и IPv4 forwarding, но сверяйся с документацией CNI.
5. Swap: по умолчанию kubelet требует отключённый swap. Современные версии умеют работать с swap при явной настройке `failSwapOn` и параметров memory swap; для базовой лаборатории проще отключить его.
6. Открой необходимые порты между узлами и установи `kubeadm`, `kubelet`, `kubectl` одной поддерживаемой minor-версии. Зафиксируй пакеты от случайного обновления.

Пример временного отключения swap:

```bash
sudo swapoff -a
swapon --show
```

Для постоянного отключения нужно отдельно изменить конфигурацию ОС (например, запись в `/etc/fstab`), а не только выполнить `swapoff`.

## 2. Инициализация первого control plane

Сначала выбери CNI и прочитай его требования к Pod CIDR. Значение CIDR в kubeadm должно совпадать с сетевой конфигурацией CNI. Не копируй адресный диапазон из чужого примера без проверки.

Пример для учебного кластера, если выбранный CNI действительно настроен на этот диапазон:

```bash
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
```

Для production и HA-кластера заранее планируют стабильный endpoint API Server, например DNS-имя балансировщика, и используют параметр `--control-plane-endpoint`. Инициализация одного узла без такого endpoint не превращает кластер автоматически в HA.

После успешного завершения настрой kubeconfig для обычного пользователя:

```bash
mkdir -p "$HOME/.kube"
sudo cp -i /etc/kubernetes/admin.conf "$HOME/.kube/config"
sudo chown "$(id -u):$(id -g)" "$HOME/.kube/config"
kubectl get nodes
```

Не копируй `admin.conf` на рабочую станцию без необходимости: это привилегированные credentials.

## 3. Что делает kubeadm init

В общих чертах kubeadm:

1. Выполняет preflight checks.
2. Создаёт PKI и kubeconfig-файлы в `/etc/kubernetes/`.
3. Генерирует static Pod manifests в `/etc/kubernetes/manifests/` для компонентов control plane и, при stacked topology, локального etcd.
4. Настраивает kubelet; kubelet запускает static Pods, читая локальные манифесты.
5. Регистрирует control-plane node и выводит команду для присоединения worker.

Static Pods запускаются kubelet напрямую, поэтому для их старта не требуется сначала обращаться к API Server. API Server затем отражает их mirror Pods в API.

## 4. Установка CNI

До установки сетевого плагина нода часто остаётся `NotReady`, а CoreDNS — в `Pending`. Это ожидаемо для нового кластера без Pod network.

Установи CNI строго по официальной инструкции выбранного проекта и для совместимой версии Kubernetes. Не существует универсального URL-манифеста, подходящего одновременно для Calico, Cilium и Flannel.

После установки проверь:

```bash
kubectl get nodes
kubectl get pods -n kube-system -o wide
kubectl get daemonsets -A
```

Проверь, что CNI Pods готовы на нужных узлах, Node становится `Ready`, а CoreDNS запускается. Убедись, что Pod CIDR не конфликтует с сетью узлов или корпоративными маршрутами.

## 5. Подключение worker nodes

Команда `kubeadm init` печатает `kubeadm join` с bootstrap token и CA hash. Выполняй её на каждом worker:

```bash
sudo kubeadm join <API_ENDPOINT>:6443 --token <TOKEN> \
  --discovery-token-ca-cert-hash sha256:<CA_CERT_HASH>
```

Bootstrap token по умолчанию имеет ограниченный срок действия (обычно 24 часа). Если он истёк, на control plane создай новый:

```bash
sudo kubeadm token create --print-join-command
```

Команда join использует доверенную проверку CA hash; не отключай проверку TLS discovery.

Для добавления дополнительного control-plane узла нужен отдельный сценарий с `--control-plane`, сертификатами и заранее спланированным HA endpoint — обычный worker join для этого не подходит.

## 6. Базовые операции Day-2

### Проверка состояния

```bash
kubectl get nodes -o wide
kubectl get pods -A
kubectl get events -A --sort-by=.metadata.creationTimestamp
kubectl cluster-info
```

### Drain перед обслуживанием

```bash
kubectl drain <node-name> --ignore-daemonsets
# работы на узле
kubectl uncordon <node-name>
```

Флаг `--delete-emptydir-data` добавляй только если осознанно допускаешь потерю локальных данных emptyDir. Drain может остановиться из-за PodDisruptionBudget или Pod, которыми нельзя безопасно управлять; не обходи блокировку, не разобравшись в причине.

### Backup etcd

В stacked-etcd kubeadm-кластере snapshot обычно делают через `etcdctl` с корректными endpoint и клиентскими сертификатами. Пути и параметры зависят от topology и версии etcd. Пример для типовой локальной конфигурации:

```bash
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt \
  --key=/etc/kubernetes/pki/etcd/healthcheck-client.key
```

Это не универсальная команда для external etcd. Храни snapshot вне узла, ограничь доступ и регулярно проверяй процедуру восстановления. Сам факт создания файла ещё не доказывает, что backup пригоден.

## 7. Что важно запомнить

- kubeadm — bootstrap tool, не полный installer всего окружения.
- CNI — отдельная обязательная часть сетевой инфраструктуры.
- Pod CIDR выбирается с учётом CNI и сетей организации.
- `admin.conf` — чувствительный cluster-admin credential.
- Backup нужно не только создавать, но и тестировать восстановление.

## Связанные заметки

- [[managed-vs-self-hosted]]
- [[cluster-upgrade]]
- [[pod-disruption-budget]]
- [[how-kubectl-works]]
- [[what-is-kubernetes]]
