10. Kubernetes CRD Glossary

Справочник основных терминов, используемых при работе с CustomResourceDefinitions, Custom Resources, Controllers и Operators.

A

API Group

Группа Kubernetes API, объединяющая связанные ресурсы.

Пример: lab.example.com.

API Version

Версия API, через которую доступен ресурс.

Пример: lab.example.com/v1.

Admission Controller

Механизм Kubernetes API Server, который участвует в обработке запросов на создание, изменение и удаление объектов.

C

CEL (Common Expression Language)

Язык выражений, который используется для реализации дополнительных правил валидации CRD.

Controller

Компонент, который наблюдает за Kubernetes-ресурсами и приводит фактическое состояние к желаемому.

Conversion Webhook

Внешний HTTPS-сервис, который преобразует Custom Resources между версиями API.

Custom Resource (CR)

Конкретный объект, созданный на основе CRD.

CustomResourceDefinition (CRD)

Kubernetes-ресурс, позволяющий регистрировать новые типы ресурсов в Kubernetes API.

D

Defaulting

Механизм установки значений по умолчанию для полей Custom Resource.

Desired State

Желаемое состояние системы, описанное пользователем в spec.

E

etcd

Распределённое key-value хранилище, используемое Kubernetes для хранения состояния кластера.

F

Finalizer

Механизм, позволяющий контроллеру выполнить действия перед окончательным удалением Kubernetes-объекта.

G

Garbage Collector

Компонент Kubernetes, который управляет удалением зависимых объектов на основе OwnerReferences.

K

Kind

Тип Kubernetes-ресурса.

Примеры: Pod, Deployment, Database.

M

Mutating Webhook

Admission Webhook, который может изменять объект перед его сохранением.

O

OpenAPI v3 Schema

Схема, описывающая структуру и допустимые значения Custom Resource.

Operator

Программный компонент, который автоматизирует управление приложением или инфраструктурой с помощью Kubernetes API и Controllers.

OwnerReference

Связь между объектами Kubernetes, указывающая на объект-владелец.

R

Reconciliation Loop

Цикл работы Controller, в котором сравнивается желаемое и фактическое состояние системы.

Resource Scope

Определяет, является ресурс Namespaced или Cluster-scoped.

S

Schema Validation

Проверка Custom Resource на соответствие определённой Schema.

Spec

Желаемая конфигурация ресурса.

Status

Информация о наблюдаемом состоянии ресурса.

Storage Version

Версия API, в которой новые или обновляемые объекты сохраняются в etcd.

status.storedVersions

Поле CRD Status, показывающее версии, которые учитываются Kubernetes при управлении хранимыми объектами.

V

Validating Webhook

Admission Webhook, который проверяет объект и может отклонить запрос.

Version Conversion

Преобразование Custom Resource между разными версиями API.

W

Watch

Механизм наблюдения за изменениями Kubernetes API.

Важные различия
Термины	Различие
CRD / CR	Определение типа / экземпляр
CR / Controller	Объект данных / управляющая логика
Controller / Operator	Механизм управления / автоматизация жизненного цикла приложения
Spec / Status	Желаемое / наблюдаемое состояние
Served / Storage	Доступная API-версия / версия хранения
Mutating / Validating Webhook	Изменение / проверка объекта
Finalizer / OwnerReference	Отложенное удаление / связь владения
CR deletion / CRD deletion	Удаление одного объекта / удаление типа со всеми его CR
