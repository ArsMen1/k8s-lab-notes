
# Обновление кластера Kubernetes (Cluster Upgrade)

Обновление Kubernetes в продакшене — это поэтапный процесс без остановки работы приложений (Zero-Downtime). Главная особенность: **нельзя перепрыгивать через минорные версии** (например, с `1.29` сразу на `1.31` — только `1.29 -> 1.30 -> 1.31`).

---

## 📏 Правило совместимости версий (Version Skew Policy)

Kubernetes строго регламентирует разницу версий между компонентами во время обновления:
* **`kube-apiserver`** — всегда самый новый компонент в кластере (эталон версии `X.Y`).
* **`kube-controller-manager`, `kube-scheduler`** — могут отставать от API-сервера максимум на **1 минорную версию** (`X.Y-1`).
* **`kubelet` (на ворк-нодах)** — может отставать от API-сервера максимум на **3 минорные версии** (`X.Y-3`), но не может быть новее него.
* **`kubectl`** — может отличаться на **1 минорную версию** в обе стороны (`X.Y+1` или `X.Y-1`).

> 💡 **Золотой порядок обновления:** Сначала Control Plane (начиная с `kube-apiserver`), затем по очереди Worker-ноды.

---

## 🛠️ Алгоритм обновления Self-Hosted кластера (`kubeadm`)

### Шаг 0: Подготовка и страховка (Обязательно!)
1. **Проверить Release Notes:** Убедиться, что в новой версии не удалили API, которые используют ваши манифесты (например, переход с `extensions/v1beta1` на `apps/v1` или изменение версий `Ingress`).
2. **Сделать бэкап `etcd`:** Если при обновлении что-то сломается, откат `kubeadm` не поддерживается — восстанавливаться придется из снепшота `etcd`.

---

### Шаг 1: Обновление первой Master-ноды (Control Plane)

1. **Обновить пакет `kubeadm`:**
   ```bash
   sudo apt-mark unhold kubeadm && \
   sudo apt-get update && sudo apt-get install -y kubeadm='1.31.x-*' && \
   sudo apt-mark hold kubeadm
   ```
2. **Проверить план обновления:** `kubeadm` проверит состояние кластера и покажет, какие компоненты и до каких версий будут обновлены.
   ```bash
   sudo kubeadm upgrade plan
   ```
3. **Применить обновление Control Plane:** Эта команда обновит статические манифесты (`apiserver`, `scheduler`, `controller-manager`, `etcd`) и продлит сертификаты на 1 год.
   ```bash
   sudo kubeadm upgrade apply v1.31.0
   ```
4. **Вывести мастер-ноду из-под нагрузки (`drain`)** и обновить `kubelet` + `kubectl`:
   ```bash
   kubectl drain master-node --ignore-daemonsets
   
   sudo apt-mark unhold kubelet kubectl && \
   sudo apt-get update && sudo apt-get install -y kubelet='1.31.x-*' kubectl='1.31.x-*' && \
   sudo apt-mark hold kubelet kubectl
   
   sudo systemctl daemon-reload
   sudo systemctl restart kubelet
   
   kubectl uncordon master-node
   ```
*(Если мастер-нод несколько (HA), на остальных запускается `sudo kubeadm upgrade node` вместо `apply`)*.

---

### Шаг 2: Поочередное обновление Worker-нод

Ворк-ноды обновляются **строго по одной**, чтобы приложения не потеряли доступность (соблюдаем `PodDisruptionBudget`).

1. **Эвакуировать поды с ноды (с Control Plane):**
   Команда `drain` запрещает планировщику ставить новые поды на ноду (`SchedulingDisabled`) и корректно выселяет текущие (они пересоздадутся на других нодах).
   ```bash
   kubectl drain worker-1 --ignore-daemonsets --delete-emptydir-data
   ```
2. **На самой `worker-1` обновить `kubeadm` и конфигурацию узла:**
   ```bash
   sudo apt-mark unhold kubeadm && \
   sudo apt-get update && sudo apt-get install -y kubeadm='1.31.x-*' && \
   sudo apt-mark hold kubeadm
   
   sudo kubeadm upgrade node
   ```
3. **Обновить `kubelet` и `kubectl` на `worker-1`:**
   ```bash
   sudo apt-mark unhold kubelet kubectl && \
   sudo apt-get update && sudo apt-get install -y kubelet='1.31.x-*' kubectl='1.31.x-*' && \
   sudo apt-mark hold kubelet kubectl
   
   sudo systemctl daemon-reload
   sudo systemctl restart kubelet
   ```
4. **Вернуть ноду в строй (с Control Plane):**
   ```bash
   kubectl uncordon worker-1
   ```

---

## ☁️ Как происходит обновление в Managed K8s (EKS / GKE / Yandex)

В облаках процесс делится на два независимых этапа:

1. **Control Plane:** Обновляется в 1 клик (или через Terraform). Облако само меняет версии API-серверов под капотом без даунтайма.
2. **Worker Nodes (Node Groups):** Обычно используется стратегия **Blue/Green (Surge Upgrade)**:
   * Облако создает новые виртуальные машины уже с новой версией `kubelet`.
   * Старые ноды переводятся в статус `drain`, поды плавно переезжают на новые ноды.
   * После полного переезда старые виртуальные машины удаляются.

---

## 👀 Что увидел в кластере

Во время выполнения `kubectl drain worker-1` статус ноды в выводе `kubectl get nodes` временно меняется на `Ready,SchedulingDisabled`:

```text
NAME          STATUS                     ROLES           AGE   VERSION
master-node   Ready                      control-plane   10d   v1.31.0
worker-1      Ready,SchedulingDisabled   <none>          10d   v1.30.4
worker-2      Ready                      <none>          10d   v1.30.4
```
После выполнения `kubectl uncordon worker-1` статус возвращается в `Ready`, а версия обновляется до `v1.31.0`.

---

## Связанные заметки
* Поднятие кластера через kubeadm: [[kubeadm-bootstrap]]
* Managed K8s vs Self-Hosted: [[managed-vs-self-hosted]]
* Как безопасно выселять поды (PDB): [[pod-disruption-budget]]