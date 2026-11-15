# Production Support: практикум диагностики

Цель — научиться строить проверяемую цепочку: симптом → факты → гипотезы → root cause → безопасное действие → подтверждение восстановления.

## Правила безопасности

- Начинай с read-only команд. Не выполняй delete, drain, scale, rollout undo, patch или apply в рабочем кластере без согласованного incident/change action.
- Перед командами проверь kubectl config current-context, namespace и объект.
- Не выводи значения Secret в тикеты и логи. Обычно достаточно имён ключей и метаданных.
- Сохраняй временные метки, Events, логи и метрики до изменения состояния.
- Команды kubectl run создают Pod; запускай их только в разрешённом диагностическом namespace.

## Базовый сбор фактов

    kubectl config current-context
    kubectl get nodes -o wide
    kubectl get pods -A -o wide
    kubectl get events -A --sort-by=.metadata.creationTimestamp
    kubectl get deploy,rs,sts,ds,svc,ingress,pvc -A

Зафиксируй время начала, затронутые namespace/workloads, масштаб влияния и последнее известное изменение. Не начинай с перезапуска Pod: он может уничтожить важные признаки.

---

## 1. PVC остаётся Pending

**Симптом:** Pod не стартует; Events содержат unbound immediate PersistentVolumeClaims или PVC долго остаётся Pending.

**Диагностика**

    kubectl get pvc -n <namespace>
    kubectl describe pvc <claim> -n <namespace>
    kubectl get pv
    kubectl get storageclass
    kubectl describe storageclass <storage-class>
    kubectl get pods -A | grep -i csi
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Проверь существование запрошенного StorageClass и default class, access mode, размер, CSI controller/node plugin, capacity и topology. При volumeBindingMode WaitForFirstConsumer привязка может ожидать планирования Pod — это не обязательно ошибка.

**Типичные root cause:** отсутствующий StorageClass, неисправный CSI provisioner, несовместимый access mode, нехватка capacity или конфликт topology.

**Безопасное исправление:** не удаляй PVC/PV для «пересоздания» — возможна потеря данных. Согласуй корректный StorageClass, восстановление CSI или устранение capacity/topology проблемы. Перед любыми действиями проверь reclaim policy и backup.

**Проверка:** PVC становится Bound, Pod проходит mount и становится Ready; отдельно проверь доступность и целостность данных приложения.

---

## 2. Контейнер завершился с OOMKilled

**Симптом:** Last State показывает Reason: OOMKilled. Код 137 сам по себе не доказывает OOM — сопоставь его с reason, Events и метриками.

**Диагностика**

    kubectl describe pod <pod> -n <namespace>
    kubectl get pod <pod> -n <namespace> -o jsonpath='{range .status.containerStatuses[*]}{.name}{": "}{.lastState.terminated.reason}{" exit="}{.lastState.terminated.exitCode}{"\n"}{end}'
    kubectl logs <pod> -n <namespace> -c <container> --previous --tail=200
    kubectl top pod <pod> -n <namespace> --containers
    kubectl top nodes
    kubectl describe node <node>

Сравни memory requests/limits, фактическое потребление и пики, рестарты, Node condition MemoryPressure и последние изменения. kubectl top — текущая выборка, не замена историческим метрикам.

**Типичные root cause:** слишком низкий memory limit, утечка памяти, всплеск нагрузки/кэша, неверные requests/limits или конкуренция за память на Node.

**Безопасное исправление:** сохрани логи и метрики. Через change-процесс выбери rollback регрессии, исправление утечки, ограничение нагрузки или обоснованную корректировку ресурсов. Не увеличивай limit вслепую: проблема может перейти на Node и вызвать eviction/OOM других Pod.

**Проверка:** рестарты прекратились, потребление памяти стабильно относительно лимита, latency/error rate вернулись к baseline, MemoryPressure отсутствует.

---

## 3. Service существует, но соединение не проходит

**Симптом:** DNS-имя Service разрешается, но запрос завершается timeout/refused либо у Service нет ready backend endpoints.

**Диагностика**

    kubectl get svc <service> -n <namespace> -o yaml
    kubectl get pods -n <namespace> --show-labels -o wide
    kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<service> -o yaml
    kubectl describe pod <pod> -n <namespace>
    kubectl get networkpolicy -n <namespace>
    kubectl get svc -n kube-system
    kubectl get pods -n kube-system --show-labels -o wide
    kubectl get endpointslices -n kube-system -l kubernetes.io/service-name=<dns-service> -o yaml
    kubectl get configmaps -n kube-system
    kubectl logs -n kube-system <coredns-pod> --all-containers=true --tail=100
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Сначала определи фактическое имя DNS Service, его EndpointSlice, ConfigMap и CoreDNS Pod по выводу команд выше. Не предполагай, что Service всегда называется kube-dns или что Pod имеет label k8s-app=kube-dns.

    kubectl run netcheck -n <namespace> --rm -it --restart=Never --image=busybox:1.36 --command -- sh -c 'cat /etc/resolv.conf; nslookup <service>'

**Типичные root cause:** selector не совпадает с labels; Pod не Ready; targetPort неверен; приложение слушает только loopback; NetworkPolicy блокирует ingress/egress; неисправны CoreDNS или CNI.

**Безопасное исправление:** меняй только подтверждённый слой. При NetworkPolicy проверь обе стороны соединения и DNS egress; не отключай все политики ради проверки.

**Проверка:** EndpointSlice содержит ожидаемые ready endpoints, DNS разрешает FQDN, а запрос проходит из нужного source namespace.

---

## 4. Pod Pending: Scheduler не находит Node

**Симптом:** Pod долго Pending; Events сообщают Insufficient cpu/memory, untolerated taint, несовпадение node selector/affinity, volume node affinity conflict или quota/admission error.

**Диагностика**

    kubectl describe pod <pod> -n <namespace>
    kubectl get nodes --show-labels
    kubectl describe nodes
    kubectl get resourcequota,limitrange -n <namespace>
    kubectl get pvc -n <namespace>
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Сравни requests (не limits) со свободной allocatable capacity подходящих Node. Проверь nodeSelector, required node affinity, taints/tolerations, topology spread, PVC и quota.

**Типичные root cause:** завышенный request, нет подходящей Node, отсутствует toleration, несовместима topology тома или исчерпана ResourceQuota.

**Безопасное исправление:** не удаляй Pod и не меняй requests без оценки потребности приложения. Возможные действия — добавить capacity, исправить ошибочную affinity/toleration, согласовать quota или пересчитать requests по метрикам.

**Проверка:** Pod назначен на ожидаемую Node, становится Ready, другие workloads не вытеснены, quota/capacity в допустимых пределах.

---

## 5. Ingress отвечает 404/502 или TLS error

**Симптом:** Ingress создан, но внешний запрос получает 404/502/503 либо TLS error.

**Диагностика**

    kubectl get ingressclass
    kubectl get ingress -A -o wide
    kubectl describe ingress <ingress> -n <namespace>
    kubectl get svc,endpointslices -n <namespace>
    kubectl get secret <tls-secret> -n <namespace>
    kubectl get pods,svc -A | grep -i ingress

Проверь логи controller по инструкции реализации, IngressClass, host/path, backend Service/port и endpoints. Для TLS проверь наличие tls.crt/tls.key без вывода значений, срок действия и SAN сертификата. TLS Secret должен находиться в namespace Ingress.

**Типичные root cause:** controller отсутствует/не обслуживает class; host/path не совпал; backend неверен или без endpoints; Secret отсутствует, не в том namespace или сертификат не подходит hostname.

**Безопасное исправление:** не создавай случайный публичный LoadBalancer и не публикуй приватный ключ. Исправь class/rules/backend или обнови Secret через утверждённый secret-management процесс.

**Проверка:** controller принял конфигурацию, backend endpoints доступны, запрос с ожидаемым Host проходит, сертификат валиден и не истёк.

---

## 6. HPA не масштабирует Deployment

**Симптом:** число реплик не растёт; HPA показывает unknown, FailedGetResourceMetric или ScalingActive=False.

**Диагностика**

    kubectl get hpa -A
    kubectl describe hpa <hpa> -n <namespace>
    kubectl get deployment <deployment> -n <namespace> -o yaml
    kubectl top pods -n <namespace>
    kubectl get apiservice v1beta1.metrics.k8s.io
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Для CPU utilization нужны корректные CPU requests у целевых контейнеров. Проверь metrics API, metrics-server, scaleTargetRef, min/max replicas, quota и capacity.

**Типичные root cause:** metrics API недоступен, CPU requests отсутствуют, HPA смотрит не на тот Deployment, достигнут maxReplicas или нет capacity.

**Безопасное исправление:** восстанови pipeline метрик или исправь target/requests через change-процесс. Не повышай maxReplicas без проверки capacity, лимитов и downstream dependencies.

**Проверка:** HPA получает актуальные метрики, Conditions здоровы, desired/actual replicas согласуются, latency и saturation улучшаются.

---

---

## 7. Запрос к API Server возвращает Forbidden

**Симптом:** kubectl или приложение получает HTTP 403 Forbidden. Аутентификация могла пройти успешно; отказ относится к авторизации или admission policy.

**Диагностика**

    kubectl auth whoami
    kubectl auth can-i get pods -n <namespace>
    kubectl auth can-i list secrets -n <namespace>
    kubectl get serviceaccount,role,rolebinding -n <namespace>
    kubectl get clusterrole,clusterrolebinding
    kubectl describe rolebinding <binding> -n <namespace>

Если проверяешь права конкретного ServiceAccount и у тебя есть право impersonation:

    kubectl auth can-i get configmaps -n <namespace> --as=system:serviceaccount:<namespace>:<service-account>

Проверь identity из ошибки, namespace, verb, resource, resource name и API group. Role действует в одном namespace; ClusterRole может быть связан на уровне namespace через RoleBinding или на уровне кластера через ClusterRoleBinding. Убедись, что приложение использует ожидаемый ServiceAccount.

**Типичные root cause:** отсутствующий/неверный RoleBinding, binding с неправильным subject namespace/name, недостаточный verb/resource/API group, запрос к ресурсу в другом namespace или admission webhook, возвращающий отказ.

**Безопасное исправление:** не выдавай cluster-admin и не добавляй wildcard permissions «чтобы заработало». Запроси минимальные verbs/resources в нужном scope и согласуй изменение с владельцем RBAC.

**Проверка:** kubectl auth can-i возвращает yes для требуемых операций, приложение выполняет только нужные действия, лишние права не выданы.

---

## 8. NetworkPolicy блокирует трафик или DNS

**Симптом:** Pod и Service Ready, но соединение зависает/timeout после включения NetworkPolicy или изменения сетевой политики.

**Диагностика**

    kubectl get networkpolicy -A
    kubectl describe networkpolicy <policy> -n <namespace>
    kubectl get pods -n <namespace> --show-labels
    kubectl get endpointslices -n <namespace>
    kubectl get pods -n kube-system -o wide

Проверь, поддерживает ли установленный CNI enforcement NetworkPolicy. Политики суммируются: для соединения source Pod должен разрешать egress, а destination Pod — ingress. Default-deny egress также блокирует DNS, если отдельно не разрешить запросы к DNS Service/Pods по UDP и TCP 53. Сверь podSelector, namespaceSelector и labels namespace.

**Типичные root cause:** policy selector выбрал не те Pod, отсутствует разрешающее правило на одной из сторон, DNS egress не разрешён, CNI не поддерживает enforcement или dataplane не здоров.

**Безопасное исправление:** добавь узкое правило только для нужного source/destination, namespace и port. Не удаляй default-deny и не разрешай весь трафик как обходной путь.

**Проверка:** тест из исходного namespace проходит к целевому Service; неразрешённые направления остаются заблокированными; DNS резолвится.

---

## 9. Node NotReady

**Симптом:** Node condition Ready=False/Unknown; Pod на узле могут стать NotReady или быть rescheduled после controller eviction.

**Диагностика**

    kubectl get nodes -o wide
    kubectl describe node <node>
    kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
    kubectl get events -A --sort-by=.metadata.creationTimestamp
    kubectl get lease -n kube-node-lease <node> -o yaml

Проверь node conditions, taints, heartbeat/Lease, kubelet/runtime status, CNI, disk/memory pressure и доступность control plane. Для managed Kubernetes используй также provider node health events.

**Root cause:** отдели недоступность Node/control plane от kubelet/runtime crash, сетевой проблемы, нехватки ресурсов и планового maintenance.

**Безопасное исправление:** не выполняй drain/delete node автоматически. Сначала проверь workload replicas, PDB, capacity других узлов и владельца инфраструктуры. Перезапуск kubelet/Node — change action для администратора платформы.

**Проверка:** Node Ready стабильно, системные Pods healthy, workload восстановлен, нет повторных node condition transitions.

---

## 10. DiskPressure и ephemeral storage

**Симптом:** Node показывает DiskPressure, Pod evicted, container logs или writable layer занимают локальный диск.

**Диагностика**

    kubectl describe node <node>
    kubectl get pods -A -o wide --field-selector spec.nodeName=<node>
    kubectl describe pod <pod> -n <namespace>
    kubectl get events -A --sort-by=.metadata.creationTimestamp
    kubectl top nodes

Проверь node filesystem/image filesystem, container logs, image garbage collection, emptyDir, writable layers и ephemeral-storage requests/limits. kubectl top обычно не показывает полный disk usage; нужны node exporter/provider metrics и безопасные host diagnostics.

**Root cause:** раздели imagefs/nodefs pressure, log growth, emptyDir exhaustion, image accumulation и системный диск.

**Безопасное исправление:** согласуй log rotation/retention, очистку только неиспользуемых images по процедуре runtime, ограничения emptyDir и корректные ephemeral-storage requests/limits. Не удаляй вручную файлы из runtime directories.

**Проверка:** DiskPressure исчез, filesystem usage ниже eviction threshold, нет новых eviction и logging pipeline продолжает работать.

---

## 11. FailedMount / FailedAttachVolume

**Симптом:** Pod застрял в ContainerCreating; Events содержат FailedMount или FailedAttachVolume.

**Диагностика**

    kubectl describe pod <pod> -n <namespace>
    kubectl get pvc -n <namespace>
    kubectl describe pvc <claim> -n <namespace>
    kubectl get pv
    kubectl get storageclass
    kubectl get csidrivers
    kubectl get pods -n kube-system -o wide

Проверь PVC Bound, PV node affinity, access mode, attachment limits, CSI controller/node plugin, Secret/ConfigMap references и filesystem errors.

**Root cause:** различи несуществующий Secret/ConfigMap, unbound PVC, attach conflict, topology mismatch, driver failure и permission/filesystem issue.

**Безопасное исправление:** не удаляй PVC/PV и не делай force detach без подтверждения, что volume не используется другой Node. Исправляй конкретную dependency или передавай CSI issue владельцу storage.

**Проверка:** mount завершён, Pod Ready, приложение видит ожидаемый filesystem и данные.

---

## 12. ImagePullBackOff

**Симптом:** Pod не стартует; Events содержат ErrImagePull/ImagePullBackOff.

**Диагностика**

    kubectl describe pod <pod> -n <namespace>
    kubectl get pod <pod> -n <namespace> -o jsonpath='{.spec.containers[*].image}{"\n"}'
    kubectl get serviceaccount <service-account> -n <namespace> -o yaml
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Проверь image name/tag/digest, registry reachability, DNS/network, rate limits, imagePullSecrets и права ServiceAccount. Не выводи содержимое registry credentials.

**Root cause:** отличи manifest typo/tag missing от unauthorized, TLS/CA error, DNS/timeout и registry rate limit.

**Безопасное исправление:** исправь подтверждённый image reference или настрой scoped pull secret через secret-management процесс. Не используй публичный/анонимный доступ как обход приватного registry.

**Проверка:** образ скачан, контейнер стартовал, Pod Ready, image digest соответствует ожидаемому release.

## 13. Alert не загружается или не доходит до Alertmanager

**Симптом:** ожидаемого alert нет в Prometheus/Alertmanager либо rule загружен, но состояние не переходит в Pending/Firing.

**Диагностика**

    kubectl get pods,svc -n monitoring
    kubectl get prometheus -A
    kubectl get servicemonitors,podmonitors,prometheusrules -A
    kubectl get pods -A | grep -Ei 'prometheus|operator|alertmanager'
    kubectl describe prometheusrule <rule> -n <namespace>
    kubectl get events -n monitoring --sort-by=.metadata.creationTimestamp

Через Prometheus UI проверь Targets, загруженный rule и результат самого PromQL expression. Затем проверь Alertmanager route/receiver и логи соответствующих Pods. Не выводи значения Secret с credentials receiver.

**Root cause:** rule не выбран из-за ruleSelector/ruleNamespaceSelector или labels; target не scrape-ится; PromQL возвращает пустой набор/не те series; не истёк `for`; Alertmanager route фильтрует labels/severity либо receiver недоступен.

**Безопасное исправление:** исправь подтверждённый selector, scrape target, label или выражение и согласуй изменение alert с владельцем сервиса. Не отключай alert и не ослабляй threshold только ради зелёного статуса. Синтетическое выражение `vector(1)` проверяет прохождение rule pipeline, но не подтверждает наличие сервисных метрик, корректность SLO или доставку уведомлений.

**Проверка:** Prometheus загрузил rule, expression возвращает ожидаемые series, состояние проходит ожидаемый переход; если требуется уведомление — Alertmanager выбирает ожидаемый route и receiver подтверждает доставку.

---

## Шаблон RCA

1. **Impact:** какие пользователи/операции затронуты?
2. **Timeline:** когда началось и что изменилось перед этим?
3. **Evidence:** команды, Events, логи и метрики с временными метками.
4. **Hypotheses:** минимум две проверяемые версии.
5. **Root cause:** конкретный механизм, подтверждённый фактами.
6. **Mitigation:** минимальное обратимое действие и согласование.
7. **Validation:** какие сигналы доказывают восстановление?
8. **Prevention:** alert, dashboard, тест, runbook или изменение процесса.

## Официальные справочники

- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
