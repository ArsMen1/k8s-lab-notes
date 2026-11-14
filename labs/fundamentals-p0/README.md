# P0 Fundamentals: Storage, StatefulSet, RBAC, QoS, DNS, NetworkPolicy

Шесть практических сценариев для Production Support. Выполняй только в disposable учебном кластере, не в production.

## Подготовка

    kubectl config current-context
    kubectl get nodes
    kubectl get storageclass
    kubectl get csidrivers
    kubectl get pods -n kube-system --show-labels

Манифесты создают namespace lab-p0. Убедись, что он не занят чужой работой. Не запускай kubectl apply -f Manifests/ целиком.

## Lab 1 — PVC Pending

Подготовка: [Storage theory](../../Theory/09-storage/README.md), [manifests](../../Manifests/storage/README.md).

Симптом: PVC остаётся Pending.

Диагностика:

    kubectl get sc
    kubectl describe pvc demo-data -n lab-p0
    kubectl get pv
    kubectl get events -n lab-p0 --sort-by=.metadata.creationTimestamp

Гипотезы: нет default StorageClass, неподходящий access mode/capacity, нет PV, provisioner/CSI error, topology или delayed binding.

Root cause: зафиксируй конкретное событие PVC и подтверди его состоянием StorageClass/PV/CSI. Не называй CSI неисправным без evidence.

Безопасное исправление: в тестовом кластере выбери существующий StorageClass либо исправь provisioner по инструкции платформы. Не удаляй claim с данными.

Проверка: PVC Bound, Pod монтирует claim и пишет тестовый файл.

## Lab 2 — StatefulSet identity и persistent claim

Подготовка: [StatefulSet theory](../../Theory/10-statefulset/README.md), [manifests](../../Manifests/statefulset/README.md).

Задание: объясни имена web-0/web-1, DNS имена, количество PVC и что переживёт удаление Pod.

Диагностика:

    kubectl get sts,pods,pvc,svc -n lab-p0
    kubectl describe sts web -n lab-p0
    kubectl get endpointslices -n lab-p0 -l kubernetes.io/service-name=web
    kubectl describe pod web-0 -n lab-p0

Root cause при Pending: проверь PVC ordinal, storage provisioning, selector, serviceName и Events.

Безопасное исправление: исправь только доказанную причину. Не удаляй PVC ради пересоздания StatefulSet.

Проверка: после пересоздания Pod он получает тот же ordinal и прежний PVC. Проверь тестовый файл после контролируемого удаления Pod.

## Lab 3 — RBAC Forbidden

Подготовка: [RBAC theory](../../Theory/11-rbac/README.md), [manifests](../../Manifests/rbac/README.md).

Симптом: ServiceAccount не может читать ConfigMap либо получает Forbidden на Secret.

Диагностика:

    kubectl auth can-i get configmaps -n lab-p0 --as=system:serviceaccount:lab-p0:config-reader
    kubectl auth can-i get secrets -n lab-p0 --as=system:serviceaccount:lab-p0:config-reader
    kubectl get role,rolebinding -n lab-p0
    kubectl describe rolebinding configmap-reader -n lab-p0

Ожидается yes для ConfigMaps и no для Secrets. Impersonation требует прав у текущего пользователя.

Root cause: проверь subject, namespace ServiceAccount, API group, resource, verb и scope.

Безопасное исправление: только нужные verbs/resources в namespace Role. Не используй cluster-admin.

Проверка: разрешённое действие работает, неразрешённое остаётся запрещено.

## Lab 4 — Resources, QoS и OOMKilled

Подготовка: [Resources theory](../../Theory/12-resources-qos/README.md), [manifest](../../Manifests/resources/README.md).

Задание: определи QoS class и объясни CPU throttling, OOMKilled и Evicted.

Диагностика:

    kubectl get pod resource-demo -n lab-p0 -o jsonpath='{.status.qosClass}{"\n"}'
    kubectl describe pod resource-demo -n lab-p0
    kubectl describe node <node>
    kubectl top pod resource-demo -n lab-p0
    kubectl get events -A --sort-by=.metadata.creationTimestamp

Root cause: отличай memory limit контейнера от node MemoryPressure и ephemeral storage exhaustion. kubectl top не показывает исторический peak.

Безопасное исправление: пересмотри requests/limits, emptyDir и log rotation по реальному профилю и node capacity. Не поднимай limit без оценки capacity.

Проверка: нет повторных OOMKilled/eviction под репрезентативной нагрузкой; scheduler может разместить replicas. OOM экспериментируй только на disposable node.

## Lab 5 — DNS/CoreDNS failure

Симптом: приложение не разрешает Service FQDN.

Диагностика:

    kubectl get svc -n kube-system
    kubectl get pods -n kube-system --show-labels
    kubectl get endpointslices -n kube-system -l kubernetes.io/service-name=kube-dns
    kubectl get configmap coredns -n kube-system

Из Pod проверь /etc/resolv.conf и nslookup kubernetes.default, затем FQDN нужного Service. Учитывай, что образ может не содержать nslookup.

Root cause: если cluster и external DNS не работают — Pod DNS config, DNS Service/endpoints, CoreDNS или NetworkPolicy; если cluster работает, а external нет — forward/upstream; если FQDN работает, а короткое имя нет — namespace/search domains.

Безопасное исправление: исправляй доказанную причину. Не редактируй Corefile и не перезапускай DNS без change plan.

Проверка: cluster FQDN и нужные внешние имена резолвятся из workload namespace.

## Lab 6 — NetworkPolicy: DNS и приложение

Подготовка: [NetworkPolicy theory](../../Theory/14-networkpolicy/README.md). Убедись в поддержке CNI и проверь labels CoreDNS. Используй только lab-p0.

Симптом: после default-deny frontend не достигает backend и/или DNS.

Диагностика:

    kubectl get networkpolicy -n lab-p0
    kubectl describe networkpolicy -n lab-p0
    kubectl get pods -n lab-p0 --show-labels
    kubectl get pods -n kube-system --show-labels

Проверь DNS egress и frontend→backend ingress отдельно. Эффективное enforcement диагностируй средствами своего CNI.

Root cause: неверный selector, отсутствующее разрешающее ingress/egress правило, DNS не разрешён либо CNI не применяет policy.

Безопасное исправление: добавь узкое правило для нужных Pod, namespace и ports. Не удаляй default-deny и не включай allow-all.

Проверка: DNS работает; frontend достигает backend TCP/80; неразрешённые направления остаются заблокированы.

## Шаблон RCA

- Симптом и impact:
- Timeline:
- Evidence:
- Гипотезы:
- Подтверждённый root cause:
- Mitigation/fix:
- Validation:
- Prevention:
- Неизвестные факты:

## Ограничения

Storage/StatefulSet требуют подходящего StorageClass. NetworkPolicy требует CNI с enforcement и корректного CoreDNS selector. Удаление PVC может привести к потере данных. Практикум не является runtime-проверкой: после применения сверяй actual state и Events.
