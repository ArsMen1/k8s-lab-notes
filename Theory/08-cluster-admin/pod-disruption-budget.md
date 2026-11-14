# PodDisruptionBudget (PDB)

PDB ограничивает количество одновременно недоступных Pod при добровольных disruptions — например, во время `kubectl drain` или обслуживания нод. PDB не защищает от аварийного отказа ноды и не гарантирует доступность приложения сам по себе.

## Пример

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: payments-api
  namespace: payments
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: payments-api
```

Селектор должен совпадать с labels Pod, создаваемых Deployment. Проверь фактические labels до применения:

```bash
kubectl -n payments get pods --show-labels
kubectl -n payments get pdb
kubectl -n payments describe pdb payments-api
```

Можно использовать либо `minAvailable`, либо `maxUnavailable`. Значения могут быть целыми числами или процентами. Не задавай оба поля одновременно.

## Как PDB влияет на drain

```bash
kubectl drain worker-1 --ignore-daemonsets
```

Eviction API учитывает PDB. Если выселение нарушит бюджет, drain может остановиться и ждать. Это не ошибка, которую следует обходить флагом `--disable-eviction` без анализа последствий.

Перед обслуживанием ноды проверь:
- достаточно ли реплик приложения;
- размещены ли реплики на разных нодах (topology spread / pod anti-affinity);
- нет ли уже недоступных Pod;
- не блокирует ли PDB плановое обслуживание.

## Важные ограничения

- PDB действует на добровольные disruptions, а не на все причины потери Pod.
- PDB не заставляет Deployment иметь нужное число реплик.
- Один PDB не заменяет readiness probe, репликацию и распределение по нодам.
- Для однорепличного приложения `minAvailable: 1` может полностью заблокировать drain.

## Связанные заметки

- [[health-probes]]
- [[rolling-update]]
- [[cluster-upgrade]]
- [[kubeadm-bootstrap]]
