# Pod Troubleshooting Toolkit

Краткая шпаргалка read-only команд для первичной диагностики Pods и приложений. Используй конкретные namespace и container; перед любыми действиями проверяй context. Не выводи Secret, credentials, токены или sensitive environment variables.

## 0. Проверить контекст

```bash
kubectl config current-context
kubectl config get-contexts
kubectl get namespaces
```

## 1. Состояние Pod и контейнеров

```bash
kubectl get pods -n <namespace> -o wide
kubectl get pod <pod> -n <namespace> -o yaml
kubectl describe pod <pod> -n <namespace>
kubectl get pods -n <namespace> --show-labels
```

В `describe` смотри: Conditions, container states, restarts, reason, exit code, probes, mounts, Events.

## 2. Logs

```bash
kubectl logs <pod> -n <namespace> -c <container> --tail=200
kubectl logs <pod> -n <namespace> -c <container> --previous --tail=200
kubectl logs <pod> -n <namespace> --all-containers=true --tail=100
kubectl logs <pod> -n <namespace> -c <container> --since=15m
kubectl logs -f <pod> -n <namespace> -c <container>
```

`--previous` — логи предыдущего контейнера, если доступны. Сначала сохрани evidence, прежде чем предпринимать действия, которые перезапускают Pod.

## 3. Events по времени

```bash
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
kubectl get events -A --sort-by=.metadata.creationTimestamp
```

Сопоставляй Events с timeline инцидента. Events могут быть краткоживущими; при расследовании не полагайся на них как на единственный источник.

## 4. Workload и связи

```bash
kubectl get deployment,replicaset,pod -n <namespace> -o wide
kubectl describe deployment <deployment> -n <namespace>
kubectl get svc,endpointslices -n <namespace> -o wide
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service> -o yaml
kubectl get configmap -n <namespace>
kubectl get networkpolicy -n <namespace>
```

Не выгружай Secret в вывод или incident report. Если нужно проверить наличие/имя Secret, не раскрывай его данные.

## 5. Resources и Node

```bash
kubectl top pod -n <namespace>
kubectl top pod <pod> -n <namespace> --containers
kubectl get nodes
kubectl describe node <node>
```

Metrics API может быть недоступен; отсутствие вывода `kubectl top` не означает, что ресурсов не потребляется. Проверяй requests/limits и события вместе с метриками.

## 6. Exec и временная диагностика

```bash
kubectl exec <pod> -n <namespace> -c <container> -- <command>
```

Не все образы содержат shell, curl, dig, ss или другие инструменты. Не устанавливай пакеты в рабочий контейнер ради диагностики. Если требуется, используй approved debug Pod или Ephemeral Container (`kubectl debug`) в разрешённой среде, соблюдая RBAC и процесс change management.

## 7. Симптом → первые проверки

| Симптом | С чего начать |
|---|---|
| `CrashLoopBackOff` | `describe`, Events, текущие и previous logs, exit reason |
| `ImagePullBackOff` | image reference, Events, registry access, imagePullSecrets (без раскрытия данных) |
| `Pending` | Events, requests, scheduler constraints, taints, PVC |
| `Running`, но приложение недоступно | listener/bind address, ports, Service/targetPort, endpoints, network |
| `Ready 0/1` | Readiness probe, startup, dependencies, Events |
| Restart count растёт | `--previous` logs, termination reason, probe, OOM/resources |
| `Evicted` | Node pressure, QoS, memory/disk usage, Events |
| `Terminating` завис | graceful shutdown, preStop, grace period, finalizers, Node status |
| HTTP 500 | application logs, downstream dependencies, request trace |
| HTTP 502/503 | gateway/Ingress, backend readiness, endpoints, port, timeout |
| DNS работает, TCP нет | listener, routing, NetworkPolicy, CNI, firewall |
| TCP проходит, HTTP не работает | protocol, path, app configuration, response |

Таблица — начальная точка, а не диагноз. Симптомы могут иметь несколько причин; переходи к следующему слою по evidence.

## 8. Минимальный incident report

- **Impact:** кто/что затронуто, масштаб, длительность.
- **Timeline:** время обнаружения, изменения, события, действия.
- **Evidence:** состояния, Events, logs, metrics, конфигурация.
- **Hypotheses:** варианты и данные за/против.
- **Root cause:** подтверждённая первопричина.
- **Mitigation / Resolution:** что изменено и почему безопасно.
- **Validation:** как доказано восстановление.
- **Prevention:** мониторинг, alert, runbook, тест или изменение процесса.

## Safety checklist

- [ ] Проверил текущий context и namespace.
- [ ] Сохранил evidence до изменения.
- [ ] Не раскрыл Secret/credentials.
- [ ] Начал с read-only команд.
- [ ] Не удалял Pod/Service и не перезапускал workload без причины и разрешения.
- [ ] Проверил результат после mitigation.
