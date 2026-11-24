# Lab: RBAC Forbidden — приложение не может читать Kubernetes API

## Сценарий

После релиза `reporting-api` перестал обновляться внутренний список Deployments. Сам сервис доступен, Pod `Running` и `Ready`, readiness probe проходит. В application logs появляется ошибка Kubernetes API:

```text
GET /apis/apps/v1/namespaces/finance/deployments
403 Forbidden

User "system:serviceaccount:finance:reporter" cannot list
resource "deployments" in API group "apps"
in the namespace "finance"
```

Нужно установить, **какая identity делает запрос, какое действие запрещено и почему существующие Role/RoleBinding не дают нужного доступа**. Не исправляй проблему выдачей `cluster-admin`.

Данные сценария синтетические. Начинай с read-only диагностики. Не запрашивай и не выводи ServiceAccount tokens, kubeconfig, Secret values или credentials.

## Impact

- Внутренний экран состояния не обновляет список Deployments.
- Основной API приложения и пользовательские операции продолжают работать.
- Pod не перезапускается, Kubernetes workload выглядит здоровым.
- Ошибка возникает при обращении приложения к Kubernetes API.
- После релиза изменился workload или его RBAC-конфигурация.

## Задание

1. Уточни context, namespace и точный текст Forbidden.
2. Определи identity текущего kubectl-клиента и отдельно ServiceAccount приложения.
3. Разбери verb, resource, API group и namespace из ошибки.
4. Проверь Role, RoleBinding, subject и scope.
5. Используй `kubectl auth can-i` для проверки конкретного действия.
6. Найди минимально необходимое разрешение.
7. Подготовь безопасное изменение с owner, approval и rollback plan.
8. Определи verification: не только `can-i`, но и успешный application workflow.

## 1. Read-only: подтвердить контекст и workload

```bash
kubectl config current-context
kubectl auth whoami
kubectl get deploy,pods -n finance -o wide
kubectl get pod <reporting-pod> -n finance -o jsonpath='{.spec.serviceAccountName}{"\n"}'
kubectl get serviceaccount reporter -n finance -o yaml
```

Важно различать две identity:

- `kubectl auth whoami` показывает пользователя текущего kubectl context.
- `spec.serviceAccountName` показывает ServiceAccount, назначенный Pod. Именно он обычно используется приложением при обращении к Kubernetes API изнутри кластера.

Не делай вывод об identity приложения только по `kubectl auth whoami`. Если `serviceAccountName` отсутствует, Pod использует `default` ServiceAccount своего namespace.

## 2. Разобрать authorization request

Из сообщения API Server выпиши поля:

| Поле | Значение сценария |
|---|---|
| User | `system:serviceaccount:finance:reporter` |
| Verb | `list` |
| Resource | `deployments` |
| API group | `apps` |
| Namespace | `finance` |

Проверяй точное сочетание. Разрешение на `get pods` не означает разрешение на `list deployments`; `deployments` относится к API group `apps`, а не к core API group `""`.

Для других ошибок учитывай subresources:

- чтение логов — `pods/log`;
- exec в контейнер — `pods/exec`;
- масштабирование Deployment — `deployments/scale`.

## 3. Проверить Role и RoleBinding

```bash
kubectl get role,rolebinding -n finance
kubectl get rolebinding <binding> -n finance -o yaml
kubectl get role <role> -n finance -o yaml
```

Сверь:

- `RoleBinding.subjects`: `kind`, `name`, а для ServiceAccount — `namespace`;
- `RoleBinding.roleRef`: имя и тип Role/ClusterRole;
- если `roleRef.kind: Role`, существует ли Role в namespace binding;
- `rules.apiGroups`, `resources`, `verbs` и возможный `resourceNames`.

Role и RoleBinding namespaced. RoleBinding может ссылаться на ClusterRole, но выданные им namespaced permissions действуют только в namespace самого RoleBinding. ClusterRoleBinding действует на cluster scope и требует отдельного обоснования.

Не выгружай без необходимости все ClusterRole/ClusterRoleBinding кластера. Сначала исследуй конкретный subject и binding из ошибки.

## 4. Проверить effective permissions

Если у текущего оператора есть право impersonation, проверь именно ServiceAccount приложения:

```bash
kubectl auth can-i list deployments.apps -n finance \
  --as=system:serviceaccount:finance:reporter

kubectl auth can-i get pods -n finance \
  --as=system:serviceaccount:finance:reporter

kubectl auth can-i get secrets -n finance \
  --as=system:serviceaccount:finance:reporter

kubectl auth can-i list deployments.apps -n another-namespace \
  --as=system:serviceaccount:finance:reporter
```

Ожидаемые результаты для синтетического сценария при отсутствии дополнительных grants через другие RoleBinding/ClusterRoleBinding:

| Проверка | Ожидается |
|---|---|
| list deployments.apps в finance | no |
| get pods в finance | yes |
| get secrets в finance | no |
| list deployments.apps в другом namespace | no |

Если команда с `--as` отвечает, что текущий пользователь не может impersonate ServiceAccount, это **не доказывает**, что приложению запрещено действие. Это означает, что у оператора нет права на impersonation. Не пытайся обходить это ограничение: запроси проверку у уполномоченного администратора или используй утверждённый диагностический контекст.

При необходимости `kubectl auth can-i --list -n finance --as=...` помогает увидеть разрешения, но проверяй конкретный verb/resource отдельно.

## 5. Что ещё может объяснить Forbidden

Не своди каждый 403 к отсутствующему verb в Role:

- Pod использует `default` ServiceAccount вместо ожидаемого;
- RoleBinding ссылается на другое имя или namespace ServiceAccount;
- RoleBinding находится не в том namespace;
- правило содержит неправильный API group или plural resource;
- отсутствует нужный subresource;
- Role ограничивает доступ через `resourceNames`;
- приложение обращается к API в другом namespace;
- запрос отклоняет внешний proxy или authorization webhook.

Если в Role используется `resourceNames`, учти ограничение: для `list`/`watch` обычно требуется field selector по `metadata.name`; простое наличие имени ресурса в списке не означает, что обычный list разрешён.

Для операций create/update возможен отказ admission webhook уже после authorization. `kubectl auth can-i` проверяет authorization, но не доказывает, что admission policy пропустит объект. При наличии audit logs сверяй decision, user, verb, resource и namespace. Не включай подробное логирование или audit policy самостоятельно в production.

## Evidence — синтетический RBAC snapshot

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: finance
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: reporter-pod-reader
  namespace: finance
subjects:
  - kind: ServiceAccount
    name: reporter
    namespace: finance
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pod-reader
```

Binding указывает на ожидаемый ServiceAccount и namespace. Но Role разрешает только чтение Pod из core API group. В ней нет правила для `deployments.apps`.

## 6. Root cause — открой после расследования

<details>
<summary>Скрытая подсказка</summary>

Сравни точный authorization request (`list deployments.apps`) с правилами Role. Не перепутай core API group с `apps` и не расширяй scope без необходимости.

</details>

<details>
<summary>Root cause</summary>

После релиза приложение начало читать список Deployments через Kubernetes API. Pod использует ожидаемый ServiceAccount `reporter`, а RoleBinding корректно связывает его с Role `pod-reader` в namespace `finance`.

Но Role содержит только разрешения `get/list/watch pods` для core API group. Запрос `list deployments.apps` не разрешён, поэтому API Server возвращает Forbidden.

Это не проблема readiness, Service, NetworkPolicy или токена. Это несовпадение фактической потребности приложения и минимального набора RBAC permissions.

</details>

## 7. Безопасное исправление — только после approval

Если подтверждено, что приложению действительно нужно читать Deployments в `finance`, предложи добавить в существующую Role узкое правило:

```yaml
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
```

Добавляй `watch` только если приложение использует watch/informer. Сохрани существующие правила и namespace scope. Не выдавай:

- `resources: ["*"]`;
- `verbs: ["*"]`;
- ClusterRoleBinding без обоснованной cluster-wide потребности;
- `cluster-admin` для устранения единичного Forbidden.

Перед изменением проверь владельца Role, GitOps/Helm source of truth и change process. Ручной patch может быть перезаписан следующим reconciliation. В рамках этой лаборатории ничего не применяй.

## 8. Verification

После согласованного изменения:

```bash
kubectl auth can-i list deployments.apps -n finance \
  --as=system:serviceaccount:finance:reporter

kubectl auth can-i get secrets -n finance \
  --as=system:serviceaccount:finance:reporter
```

Проверь:

- нужный `can-i` теперь возвращает `yes`;
- ненужные права по-прежнему возвращают `no`;
- application request успешно получает список Deployments;
- новые Forbidden не появляются в логах;
- нет неожиданного доступа в другие namespaces;
- workload не получил лишних cluster-wide permissions.

Изменение RBAC обычно не требует перезапуска Pod: authorization проверяется при API request. Не делай rollout restart без отдельного evidence, что приложение использует закэшированную конфигурацию или credentials.

## 9. Incident report

- **Symptoms:** какой workflow сломан и какой текст Forbidden получен?
- **Identity:** какая ServiceAccount реально назначена Pod?
- **Request:** verb, resource, API group, namespace, subresource?
- **RBAC evidence:** Role, RoleBinding, subject, roleRef, scope.
- **Root cause:** какого точного разрешения не хватало и почему?
- **Mitigation:** минимальное правило, owner, approval, source of truth.
- **Verification:** результат can-i, application workflow, negative checks на лишние права.
- **Prevention:** review RBAC при изменении API usage, least privilege, tests для ServiceAccount permissions.

## Шпаргалка

| Симптом | Следующая проверка |
|---|---|
| `cannot list resource deployments` | `apiGroups: ["apps"]`, `resources: ["deployments"]`, `verbs: ["list"]` |
| Работает локально, падает в Pod | `spec.serviceAccountName`, RoleBinding subject |
| `can-i --as` запрещён оператору | Проверить право impersonation; не путать с правами приложения |
| Доступ есть в одном namespace, нет в другом | RoleBinding namespace и scope |
| Работает get, не работает list | verb, `resourceNames`, field selector |
| Forbidden после успешного can-i | Фактическая identity/request, другой authorizer, admission для write-операции |
| Разработчик просит cluster-admin | Сначала определить минимальные verb/resource/scope |

## Критерии прохождения

- [ ] Различаю identity kubectl-клиента и ServiceAccount приложения.
- [ ] Извлекаю verb, resource, API group и namespace из Forbidden.
- [ ] Проверяю Role, RoleBinding, subject, roleRef и scope.
- [ ] Использую can-i для точного действия и понимаю ограничения impersonation.
- [ ] Не путаю RBAC denial с NetworkPolicy, readiness или внешним HTTP 403.
- [ ] Предлагаю минимальное правило без wildcard и cluster-admin.
- [ ] Проверяю разрешённые и запрещённые действия после изменения.
- [ ] Не вывожу tokens, Secrets или credentials и не меняю production permissions без approval.
