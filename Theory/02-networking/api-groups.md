# API Groups в Kubernetes (`apiVersion`)

Поле `apiVersion` указывает версию Kubernetes API, через которую представлен ресурс. Обычно оно имеет вид `<group>/<version>`, но у ресурсов **Core API group** группа пустая, поэтому значение выглядит просто как `v1`.

Примеры:

| apiVersion | API group | Примеры ресурсов |
|---|---|---|
| `v1` | Core group (пустая группа) | Pod, Service, ConfigMap, Secret, Namespace |
| `apps/v1` | `apps` | Deployment, ReplicaSet, StatefulSet, DaemonSet |
| `batch/v1` | `batch` | Job, CronJob |
| `networking.k8s.io/v1` | `networking.k8s.io` | Ingress, NetworkPolicy |
| `apiextensions.k8s.io/v1` | `apiextensions.k8s.io` | CustomResourceDefinition |

## Зачем нужны API Groups

1. Группируют ресурсы по назначению.
2. Позволяют развивать разные API независимо.
3. Разделяют имена ресурсов в разных группах и версиях.

Версия API — это версия контракта, а не обязательно версия Kubernetes или приложения. Например, `apps/v1` остаётся версией API Deployment независимо от версии образа приложения.

## Как читать apiVersion кастомного ресурса

```yaml
apiVersion: lab.example.com/v1
kind: Database
```

Здесь `lab.example.com` — API group, а `v1` — версия ресурса. В нашем учебном примере группа зарегистрирована через CRD `databases.lab.example.com`.

Упрощённый CRD:

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: myresources.lab.example.com
spec:
  group: lab.example.com
  scope: Namespaced
  names:
    plural: myresources
    singular: myresource
    kind: MyResource
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
```

После регистрации CRD API Server предоставляет endpoint группы и версии. Для namespaced-ресурса путь имеет вид:

`/apis/lab.example.com/v1/namespaces/<namespace>/myresources`

Для core group используются пути под `/api/v1`, а для именованных групп — под `/apis/<group>/<version>`.

## Связь с kubectl

`kubectl` использует discovery API сервера, чтобы узнать доступные ресурсы, их группы, версии и scope. Само поле `apiVersion` в YAML не «создаёт» ресурс: соответствующий API должен уже существовать в кластере.

Проверки:

```bash
kubectl api-versions
kubectl api-resources
kubectl explain deployment
kubectl explain database --api-version=lab.example.com/v1
```

Если появляется ошибка `no matches for kind`, проверь:

1. Установлен ли нужный CRD (если это Custom Resource).
2. Доступна ли указанная версия (`served: true`).
3. Правильно ли написаны `apiVersion` и `kind`.
4. Не обращаешься ли ты к кластеру с неправильным kube-context.

Важно: CRD не равен Operator. CRD регистрирует тип ресурса; controller/operator — отдельная программа, которая может наблюдать за такими объектами и выполнять действия.

## Пример из реального инструментария

`monitoring.coreos.com/v1` и `kind: ServiceMonitor` — API, который обычно устанавливает Prometheus Operator или отдельный пакет его CRD. Наличие CRD позволяет API Server принимать объект, но без работающего контроллера объект сам по себе не настроит Prometheus.

## Связанные заметки

- [[01-what-is-crd]]
- [[how-kubectl-works]]
- [[glossary-core-objects]]
