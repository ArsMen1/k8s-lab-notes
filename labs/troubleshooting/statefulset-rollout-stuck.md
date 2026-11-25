# StatefulSet rollout завис на одном ordinal

## Цель

Научиться расследовать остановившийся rollout StatefulSet, не принимая ожидаемое поведение контроллера за поломку всего приложения и не рискуя данными на PVC.

## Симптом и impact

После релиза StatefulSet `orders-db` с тремя репликами обновление не завершается. В статусе видно две Ready-реплики из трёх, а `kubectl rollout status` продолжает ждать. Пользовательские запросы частично проходят, но владелец сервиса сообщает о снижении запаса отказоустойчивости.

Условная картина:

- `orders-db-0` и `orders-db-1` работают на предыдущей ревизии;
- `orders-db-2` создан для новой ревизии, но не становится Ready;
- `currentRevision` и `updateRevision` различаются;
- PVC для всех трёх ordinal существуют и имеют статус `Bound`.

Не делай вывод, что проблема в StatefulSet только потому, что rollout остановился. Контроллер может ждать исправления Pod, а первопричина находиться в image registry, конфигурации приложения, readiness, scheduling или storage.

## Задание

1. Зафиксируй пользовательский impact и проверь с владельцем приложения quorum/replication: две Ready-реплики не обязательно означают, что база безопасно обслуживает запись.
2. Определи, какой ordinal блокирует rollout и на какой ревизии находятся остальные Pod.
3. Проверь update strategy, partition и pod management policy. Исключи намеренно staged rollout или `OnDelete`.
4. Разбери состояние проблемного Pod и его Events.
5. Отдельно проверь PVC соответствующего ordinal. Не удаляй claim ради «пересоздания».
6. Сформулируй root cause по evidence и предложи минимальное исправление с планом проверки.

## Read-only диагностика

Сначала проверь контекст и собери состояние StatefulSet, Pod и PVC:

```bash
kubectl config current-context
kubectl get sts,pods,pvc -n <namespace> -o wide
kubectl describe sts <statefulset> -n <namespace>
kubectl get pods -n <namespace> -l app.kubernetes.io/name=<app> -o wide
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
```

Сравни ревизии и настройки rollout:

```bash
kubectl get sts <statefulset> -n <namespace> -o jsonpath='{.status.currentRevision}{" -> "}{.status.updateRevision}{" ready="}{.status.readyReplicas}/{.spec.replicas}{"\n"}'
kubectl get sts <statefulset> -n <namespace> -o jsonpath='{.spec.updateStrategy.type}{" partition="}{.spec.updateStrategy.rollingUpdate.partition}{" podManagementPolicy="}{.spec.podManagementPolicy}{"\n"}'
kubectl rollout history statefulset/<statefulset> -n <namespace>
```

Если `podManagementPolicy` не задан, по умолчанию используется `OrderedReady`. Если `partition` не задан, для RollingUpdate обычно действует значение по умолчанию 0. Сверяй фактический объект, а не только Git-манифест.

Исследуй конкретный ordinal:

```bash
kubectl describe pod <statefulset>-<ordinal> -n <namespace>
kubectl get pod <statefulset>-<ordinal> -n <namespace> -o jsonpath='{range .status.containerStatuses[*]}{.name}{" image="}{.image}{" waiting="}{.state.waiting.reason}{" message="}{.state.waiting.message}{"\n"}{end}'
kubectl get pvc -n <namespace> -o wide
kubectl describe pvc <claim-for-ordinal> -n <namespace>
```

Проверь сеть и backend-ы отдельно от rollout:

```bash
kubectl get svc <headless-service> -n <namespace> -o wide
kubectl get endpointslices -n <namespace> -l kubernetes.io/service-name=<headless-service>
```

EndpointSlice показывает готовность backend-ов на уровне Service, но не подтверждает здоровье репликации или quorum внутри stateful-приложения. Для этого нужны application-specific health checks и метрики.

## Условные evidence этого сценария

Предположим, собраны следующие факты:

- StatefulSet ожидает 3 реплики, Ready — 2.
- `currentRevision` отличается от `updateRevision`.
- `orders-db-0` и `orders-db-1` Ready; `orders-db-2` находится в `ImagePullBackOff`.
- В Events Pod указано, что registry не находит image tag `2.8.0-prodd` (`manifest unknown`).
- PVC `data-orders-db-0`, `data-orders-db-1` и `data-orders-db-2` имеют статус `Bound`; у проблемного Pod нет события FailedMount/FailedAttachVolume.
- Update strategy — `RollingUpdate`, partition не задан.

### Подтверждённый root cause в примере

В шаблоне StatefulSet указан несуществующий image tag `2.8.0-prodd`. Это ошибка release configuration, а не неисправность CSI или потеря PVC.

При RollingUpdate с `podManagementPolicy=OrderedReady` (значение по умолчанию) StatefulSet обновляет Pod по одному, начиная с наибольшего ordinal. Контроллер ждёт, пока обновлённый Pod станет Running и Ready, прежде чем переходить к предыдущему ordinal. Поэтому неготовый `orders-db-2` останавливает дальнейший rollout; старые `orders-db-0` и `orders-db-1` сами по себе не являются доказательством отдельной поломки.

## Другие причины, которые нужно отличать

| Наблюдение | Что проверять |
|---|---|
| Pod `Pending` | FailedScheduling, requests, taints/affinity, quota, PVC и volume topology |
| `ContainerCreating`, FailedMount/FailedAttachVolume | PVC, PV, StorageClass, VolumeAttachment и CSI controller/node plugin |
| `ImagePullBackOff` | image tag/digest, registry reachability, pull secret и Events |
| `CrashLoopBackOff` или Readiness probe failure | previous logs, startup/configuration, dependency health, probe и application quorum |
| Template изменился, но Pod не обновляются | `updateStrategy.type=OnDelete`, partition и фактические revisions |
| Pod Ready, но Service не публикует backend | Headless Service selector, Pod labels и EndpointSlice |

`OnDelete` означает, что контроллер не обновляет существующие Pod автоматически: новые Pod с шаблоном появятся после контролируемого удаления старых. Partition при RollingUpdate может намеренно оставить ordinal ниже заданного значения на прежней ревизии. Не называй это дефектом, пока не сверил стратегию релиза.

## Безопасное исправление

Для evidence из этого сценария:

1. Сверь ожидаемый image tag или digest с release manifest/registry и владельцем приложения.
2. Исправь Pod template через штатный deployment/GitOps pipeline либо верни подтверждённую рабочую ревизию. Не редактируй Pod напрямую: StatefulSet управляет ими из шаблона.
3. Если после возврата корректного шаблона rollout всё ещё ждёт Pod, проверь известное поведение StatefulSet с `OrderedReady`: в некоторых неудачных обновлениях одного возврата шаблона недостаточно. После подтверждения корректного шаблона и согласования change может потребоваться контролируемо удалить только Pod, который был создан с нерабочей конфигурацией, чтобы контроллер пересоздал его.
4. Перед таким действием проверь состояние остальных реплик, quorum, PDB, доступность и владельца данных. Не используй force delete как обычный способ ускорить rollout.

Удаление Pod не равно удалению PVC, но перед любым действием всё равно проверь фактические claim names и `persistentVolumeClaimRetentionPolicy`. Не удаляй PVC/PV, не масштабируй StatefulSet в ноль и не делай force detach как способ «разблокировать» обновление.

Если причина в storage, исправляй именно подтверждённую проблему provisioner/CSI/topology/permissions по change process. Если причина в readiness или приложении, сначала выясни, почему новый ordinal не может безопасно присоединиться к кластеру приложения.

## Проверка результата

- `currentRevision` и `updateRevision` совпадают после завершения rollout.
- Все ожидаемые ordinal Pod существуют и Ready.
- PVC каждого ordinal остаётся Bound и подключён к ожидаемому Pod.
- Headless Service и EndpointSlice отражают ожидаемые backend-ы.
- Владелец приложения подтвердил replication/quorum, целостность данных и успешный прикладной health check.
- Пользовательские latency/error rate вернулись к baseline; новые Events не показывают повторную ошибку.

Не считай rollout успешным только по зелёному `kubectl rollout status`: для stateful-приложения отдельно нужна проверка его внутреннего состояния.

## Вопросы для самопроверки

1. Почему один неготовый ordinal может остановить обновление остальных Pod?
2. Почему StatefulSet обновляет Pod в обратном порядке ordinal?
3. Чем `OnDelete` отличается от `RollingUpdate`?
4. Как partition может намеренно оставить часть Pod на старой ревизии?
5. Почему PVC Pending и ImagePullBackOff требуют разных веток диагностики?
6. Почему удаление Pod не означает, что можно удалить его PVC?
7. Почему возврат шаблона к рабочей версии иногда не разблокирует rollout без отдельного действия с проблемным Pod?
8. Какие application-level проверки нужны кроме Ready и EndpointSlice?

## Incident report

- **Impact:**
- **Timeline:**
- **StatefulSet revisions / strategy:**
- **Blocked ordinal:**
- **Pod Events / logs:**
- **PVC / CSI evidence:**
- **Confirmed root cause:**
- **Safe fix / approval:**
- **Verification (Kubernetes + application):**
- **Prevention:**

## Официальная документация

- [StatefulSets: update strategies, rolling updates и forced rollback](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
