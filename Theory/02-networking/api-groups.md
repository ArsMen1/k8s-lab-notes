# API Groups в Kubernetes (`apiVersion`)

Когда ты смотришь на YAML-манифест, одна из первых строк — это `apiVersion`. Она указывает Kubernetes, к какому «разделу» API относится ресурс. 

В Kubernetes `apiVersion` всегда состоит из двух частей, разделенных слешем: `<group>/<version>`. 
*   **Group (Группа)** — логическое объединение ресурсов.
*   **Version (Версия)** — версия API внутри этой группы (например, `v1`, `v1beta1`).

## 🏗️ Зачем нужны API Groups?

Kubernetes — расширяемая система. API Groups нужны для того, чтобы:
1.  **Избежать конфликтов имен**: Твой кастомный ресурс `Deployment` не пересечется со встроенным `Deployment` из группы `apps`.
2.  **Логически сгруппировать ресурсы**: Базовые ресурсы (`Pod`, `Service`) лежат в Core Group. Ресурсы для работы с сетью — в `networking.k8s.io`, для батч-задач — в `batch`.
3.  **Управлять версиями**: Можно спокойно развивать API, переводя ресурсы из `v1alpha1` в `v1beta1`, а затем в стабильный `v1`.

## 🗂️ Виды групп

1.  **Core Group (Ядро)**: Самые базовые ресурсы. В манифестах у них просто `apiVersion: v1` (без слеша).
    *   *Примеры:* `Pod`, `Service`, `ConfigMap`, `Secret`, `Namespace`.
2.  **Named Groups (Именованные)**: Ресурсы, сгруппированные по функциональности.
    *   *Примеры:* `apps/v1` (Deployment, StatefulSet), `batch/v1` (Job, CronJob), `networking.k8s.io/v1` (Ingress).
3.  **Custom Groups (Кастомные)**: То, что создают разработчики или сторонние операторы (CRD).

## 🔍 Разбор `apiVersion: lab.example.com/v1`

Если ты видишь такой `apiVersion`, это значит, что перед тобой **кастомный ресурс**, созданный через `CustomResourceDefinition` (CRD).

*   **`lab.example.com`** — это **API Group**. По соглашению здесь используется доменное имя (FQDN), которым владеет организация (чтобы группа была уникальной во всем мире). Если ты работаешь в компании `mycompany.com`, ты можешь создать группу `apps.mycompany.com` или `lab.mycompany.com`.
*   **`v1`** — это **Version** (версия API).

### 🛠️ Как это создается (CRD)
За этим `apiVersion` стоит объект `CustomResourceDefinition`. Когда администратор кластера применяет манифест CRD:

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: myresources.lab.example.com # <plural>.<group>
spec:
  group: lab.example.com  # 👈 Наша группа
  versions:
    - name: v1            # 👈 Наша версия
      served: true
      storage: true
  scope: Namespaced
  names:
    plural: myresources
    singular: myresource
    kind: MyResource
```

Происходит следующее:
1.  Kubernetes API Server регистрирует новый эндпоинт по пути: `/apis/lab.example.com/v1/namespaces/<namespace>/myresources`.
2.  Теперь ты можешь создавать объекты с `apiVersion: lab.example.com/v1` и `kind: MyResource`.
3.  `kubectl` при виде такого `apiVersion` понимает, что нужно обратиться к этому кастомному эндпоинту, а не к встроенному API.

## 💡 Как это выглядит в реальной жизни (На примере Prometheus)

Когда ты устанавливаешь Prometheus Operator, он создает свою кастомную группу API. И тогда ты начинаешь использовать манифесты вида:
```yaml
apiVersion: monitoring.coreos.com/v1  # 👈 Кастомная группа от оператора
kind: ServiceMonitor
```
Если этого оператора в кластере нет, `kubectl apply` выдаст ошибку: `no matches for kind "ServiceMonitor" in version "monitoring.coreos.com/v1"`. Это значит, что CRD для этой группы не установлен.

## 📌 Итог для практики:
Если в чужом манифесте или туториале ты видишь `apiVersion` с доменом (например, `cert-manager.io/v1`), это значит, что перед применением файла в кластере должен быть установлен соответствующий оператор (CRD).

## 🔗 Связанные заметки:
* Базовые объекты: [[glossary-core-objects]]
* Как kubectl работает с API: [[how-kubectl-works]]