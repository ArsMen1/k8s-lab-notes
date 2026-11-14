# Поднятие кластера с нуля через kubeadm

`kubeadm` — это официальная утилита для развертывания минимально жизнеспособного и безопасного кластера Kubernetes. Она не устанавливает сетевые плагины (CNI) и не управляет самим железом — она только связывает компоненты K8s воедино.

## 1. Подготовка всех узлов (Master и Worker)

Перед инициализацией на каждом сервере нужно подготовить операционную систему:

1. **Отключить Swap:** `kubelet` требует отключения файла подкачки, чтобы точно контролировать память контейнеров и корректно работать с OOM Killer.
   ```bash
   sudo swapoff -a
   ```
2. **Включить модули ядра и маршрутизацию сети:** Для работы виртуальных сетей контейнеров нужны модули `overlay` и `br_netfilter`, а также разрешение на пересылку трафика (`ip_forward = 1`).
3. **Установить Container Runtime (CRI):** Например, `containerd`. Критически важно настроить его на использование драйвера `SystemdCgroup = true`, чтобы он совпадал с драйвером `kubelet`.
4. **Установить пакеты Kubernetes:** Ставятся три бинарника (`kubeadm`, `kubelet`, `kubectl`) и фиксируются от случайного обновления через `apt-mark hold`.

## 2. Инициализация Control Plane (`kubeadm init`)

Запускается только на первой мастер-ноде:

```bash
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
```

### Что происходит под капотом:
1. **Preflight checks:** Проверка портов, ядра, памяти и отключенного swap.
2. **Генерация PKI:** Создание корневых сертификатов (CA) и ключей для взаимной TLS-аутентификации всех компонентов в папке `/etc/kubernetes/pki/`.
3. **Статические манифесты:** Генерация YAML-файлов для `etcd`, `kube-apiserver`, `kube-controller-manager` и `kube-scheduler` в директории `/etc/kubernetes/manifests/`.
4. **Старт Control Plane:** Локальный `kubelet` видит эти файлы и поднимает компоненты управления как **Static Pods** (минуя API-сервер).
5. **Создание админского конфига:** Генерируется `/etc/kubernetes/admin.conf`. Чтобы начать работать, его копируют в `~/.kube/config`.

## 3. Установка сетевого плагина (CNI)

Сразу после `kubeadm init` кластер еще не готов к работе: нода находится в статусе `NotReady`, а системные поды `CoreDNS` висят в `Pending`. Им не хватает сетевого драйвера (CNI).

Устанавливается выбранный CNI (например, Calico или Cilium) обычным применением манифеста:
```bash
kubectl apply -f https://githubusercontent.com
```
После старта подов CNI нода переходит в статус `Ready`, а `CoreDNS` запускается.

## 4. Подключение рабочих узлов (`kubeadm join`)

В конце вывода `kubeadm init` выдает готовую команду с временным токеном (живет 24 часа) и хешем корневого сертификата. Она запускается на каждой Worker-ноде:

```bash
sudo kubeadm join 192.168.1.10:6443 --token <token> \
    --discovery-token-ca-cert-hash sha256:<hash>
```
`kubelet` на ворк-ноде подключается к API-серверу, проходит проверку, скачивает свои сертификаты и регистрирует узел в кластере.

## 5. Базовые операции обслуживания (Day-2)

* **Резервная копия кластера (Бэкап `etcd`):**
  ```bash
  ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-snapshot.db \
    --endpoints=https://127.0.0.1:2379 \
    --cacert=/etc/kubernetes/pki/etcd/ca.crt \
    --cert=/etc/kubernetes/pki/etcd/server.crt \
    --key=/etc/kubernetes/pki/etcd/server.key
  ```
* **Безопасный вывод ноды на обслуживание (перед обновлением ОС или K8s):**
  ```bash
  kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
  # ... проведение работ ...
  kubectl uncordon <node-name>
  ```

## 👀 Что увидел в кластере

После завершения сборки команда `kubectl get pods -n kube-system` показывает, что компоненты Control Plane работают как обычные поды с именем мастер-ноды на конце:

```text
NAME                                       READY   STATUS    RESTARTS   AGE
calico-kube-controllers-56cdb7c587-9x2kl   1/1     Running   0          2m
calico-node-4m8vp                          1/1     Running   0          2m
coredns-76f75df574-8b2vn                   1/1     Running   0          4m
etcd-master-node                           1/1     Running   0          5m
kube-apiserver-master-node                 1/1     Running   0          5m
kube-controller-manager-master-node        1/1     Running   0          5m
kube-proxy-9k4lp                           1/1     Running   0          4m
kube-scheduler-master-node                 1/1     Running   0          5m
```

## Связанные заметки
* Managed или свой кластер: [[managed-vs-self-hosted]]
* Как `kubectl` общается с `kube-apiserver`: [[kubectl-architecture]]
* Чем Pod отличается от контейнера: [[pod-vs-container]]
