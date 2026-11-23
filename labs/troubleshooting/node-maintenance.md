# Lab: Node maintenance — cordon, drain и восстановление

**Цель:** понять безопасный порядок вывода Node на maintenance и последствия для workload, без выполнения команд изменения в реальном кластере.

## Сценарий

Платформенная команда планирует обновление ОС или kubelet на Node. Нужно подготовить узел к обслуживанию и оценить, смогут ли workloads безопасно переместиться на оставшиеся Node.

## Задача

1. Установи, какие workloads находятся на целевой Node и какие из них управляются контроллерами.
2. Оцени capacity остальных Node и ограничения scheduling.
3. Проверь PDB, replicas, local storage, DaemonSets, affinity и tolerations.
4. Объясни разницу между `cordon` и `drain`.
5. Подготовь план maintenance, rollback/abort criteria и validation. Команды изменения не выполняй.

## Read-only диагностика

```bash
kubectl config current-context
kubectl get nodes -o wide
kubectl describe node <node>
kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
kubectl get pdb -A
kubectl get deploy,sts,ds -A
kubectl get pods -A -o wide
kubectl get events -A --sort-by=.metadata.creationTimestamp
```

Проверь replicas/Ready, PDB status, requests/allocatable на других Node, local PV, Pod с unmanaged owner и DaemonSets. PDB не гарантирует, что workloads смогут запланироваться на другие узлы: capacity и constraints всё равно важны.

## Ключевые понятия

- `cordon` помечает Node как unschedulable для новых обычных Pod; существующие Pod автоматически не удаляются.
- `drain` инициирует eviction Pods с Node с учётом правил эвакуации и PDB; это не просто «выключить узел».
- DaemonSet Pods и некоторые системные Pod обрабатываются особым образом; внимательно прочитай drain output.
- Local PV, неподходящая topology, unmanaged Pods или нехватка capacity могут блокировать либо усложнять эвакуацию.
- PDB может ограничить добровольные disruption, но не предотвращает все виды отказов/eviction.

## План действий (не выполняй)

В учебном кластере, после review и разрешения, администратор может использовать последовательность:

```bash
kubectl cordon <node>
kubectl drain <node> --ignore-daemonsets
# Maintenance action: выполнить отдельно по change plan
kubectl uncordon <node>
```

Это illustrative workflow, не универсальная команда для production. Флаги drain выбираются с учётом workload и Kubernetes version. Не добавляй `--force` или `--delete-emptydir-data` как обходные пути без отдельного анализа риска потери данных и владельцев Pod.

## Abort / rollback criteria

Прерви maintenance и согласуй возврат, если:
- replicas/availability опустились ниже допустимого;
- Pod не может разместиться на оставшихся Node;
- PDB запрещает disruption;
- обнаружен local/ephemeral data риск;
- Node или workload health ухудшается.

## Проверка после обслуживания

- Node вернулась в Ready и schedulable.
- System components и workloads здоровы.
- Replicas/Ready/endpoints восстановились.
- Новые Pods могут планироваться.
- Нет новых eviction, pressure или scheduling alerts.

## Incident report

Impact → Timeline → Evidence → Hypotheses → Root cause → Maintenance plan → Validation → Prevention.
