09. CRD Deletion and Data Safety
1. Почему удаление CRD опасно?

CRD (CustomResourceDefinition) — это регистрация нового типа ресурса в Kubernetes API.

Но CRD — не просто описание схемы. Он является частью механизма, через который Kubernetes хранит и обслуживает Custom Resources.

Представим, что у нас есть CRD:

yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.lab.example.com


И несколько Custom Resources:

text
Database CRD
    |
    +-- payments-db
    |
    +-- orders-db
    |
    +-- analytics-db


Если удалить один Custom Resource, удалится только конкретный объект.

Если удалить CRD, Kubernetes удалит все Custom Resources этого типа.

Это принципиально разные операции.

2. CRD vs CR: последствия удаления
Операция	Последствие
Удаление одного CR	Удаляется конкретный объект
Удаление нескольких CR	Удаляются выбранные объекты
Удаление CRD	Удаляются все CR этого типа
Удаление Controller	Прекращается автоматическое управление ресурсами
Удаление Operator	Прекращается работа его контроллеров и связанных компонентов

Важно: удаление Controller не равнозначно удалению CRD. Уже созданные Custom Resources могут остаться в кластере, но перестанут автоматически reconciliate-иться.

3. Что происходит при удалении CRD?

Допустим, мы выполняем:

bash
kubectl delete crd databases.lab.example.com


Kubernetes начинает удаление определения ресурса.

В процессе удаления связанные Custom Resources также удаляются.

Последствия могут быть серьёзными:

Все Database Custom Resources этого CRD удаляются.
Controller может получить события удаления.
Finalizers могут запустить процедуры очистки.
StatefulSet, PVC, Service и другие связанные ресурсы могут быть удалены или остаться в зависимости от логики Controller.
Внешние ресурсы могут быть удалены, оставлены без управления или потерять связь с Kubernetes API.

Особенно опасна ситуация с базами данных.

Например, PostgreSQL Operator может при удалении Database Custom Resource запустить процедуру удаления управляемого кластера.

Поведение зависит от конкретного Operator и его настроек.

Нельзя считать, что удаление CRD автоматически удаляет все внешние данные, но нельзя и рассчитывать на их сохранность.

4. Что такое Finalizers?

Finalizer — механизм Kubernetes, который позволяет контроллеру выполнить необходимые действия перед окончательным удалением объекта.

Например:

Пользователь удаляет Database.
Kubernetes устанавливает deletionTimestamp.
Объект остаётся в состоянии удаления.
Controller получает информацию об удалении.
Controller выполняет cleanup.
Controller удаляет свой finalizer.
Kubernetes окончательно удаляет объект.

Пример:

yaml
metadata:
  finalizers:
    - database.lab.example.com/finalizer


Пока finalizer присутствует, объект не будет окончательно удалён.

Это может быть необходимо для:

удаления внешней базы данных;
очистки облачной инфраструктуры;
удаления связанных ресурсов;
освобождения внешних ресурсов.

Важно: finalizer не является гарантией сохранения данных. Он лишь предоставляет контроллеру возможность выполнить cleanup.

Если Controller недоступен, объект может долго находиться в состоянии Terminating.

Не удаляй finalizer вручную без понимания его назначения и последствий.

5. Реальный сценарий: ошибка синхронизации Argo CD

Представим ситуацию.

У нас есть Argo CD Application, которое управляет Database:

yaml
apiVersion: lab.example.com/v1
kind: Database

metadata:
  name: payments-db

spec:
  engine: postgres
  version: "17"


Argo CD показывает:

text
Sync Failed


Первая мысль:

"Удалю Custom Resource, Argo CD создаст его заново".

Но это не универсальное решение.

Почему?

Потому что Argo CD работает с декларативным состоянием.

Если объект существует в Git, Argo CD видит, что он должен существовать в кластере.

Удаление объекта вручную может привести к тому, что Argo CD снова создаст его при следующей синхронизации или self-heal.

Но это не означает, что проблема будет исправлена.

Если причина ошибки находится в:

неправильной Schema;
неправильном apiVersion;
недоступном Admission Webhook;
несовместимой версии CRD;
ошибке Controller;
проблеме RBAC;

то повторное создание объекта может привести к той же ошибке.

6. Когда удаление Custom Resource действительно может помочь?

Удаление CR иногда является оправданным действием.

Например:

Ресурс создан с неправильными параметрами.
Controller не поддерживает изменение определённых immutable-полей.
Нужно полностью пересоздать управляемый объект.
Ресурс находится в некорректном состоянии, а документация Operator предусматривает его пересоздание.

Но перед удалением необходимо проверить:

Какие ресурсы создал Controller?
Есть ли finalizers?
Будут ли удалены PVC?
Будет ли удалена внешняя инфраструктура?
Есть ли backup?
Не приведёт ли удаление к downtime?

Удаление CR — это не просто повторная синхронизация. Для Operator это может быть полноценная команда на удаление управляемого приложения.

7. Правильный алгоритм диагностики Argo CD

Если Argo CD не может синхронизировать Custom Resource, действуем последовательно.

Шаг 1. Проверяем статус Application
bash
argocd app get my-application


Смотрим:

Sync Status;
Health Status;
Conditions;
Operation State.
Шаг 2. Проверяем конкретную ошибку
bash
kubectl describe database payments-db


Проверяем события:

bash
kubectl get events \
  --sort-by=.metadata.creationTimestamp

Шаг 3. Проверяем CRD
bash
kubectl get crd databases.lab.example.com


Проверяем Schema:

bash
kubectl get crd databases.lab.example.com -o yaml

Шаг 4. Проверяем Custom Resource
bash
kubectl get database payments-db -o yaml


Обращаем внимание на:

apiVersion;
spec;
status;
finalizers;
deletionTimestamp;
managedFields.
Шаг 5. Проверяем Controller
bash
kubectl get pods -A


Находим Pod соответствующего Operator.

Проверяем логи:

bash
kubectl logs -n operator-system \
  deployment/database-operator


Название namespace и Deployment необходимо заменить на реальные.

Шаг 6. Проверяем причину ошибки

Нужно определить, где именно проблема:

Argo CD;
Kubernetes API Server;
CRD Schema;
Admission Webhook;
Controller;
внешняя инфраструктура.

Только после этого принимаем решение о корректирующем действии.

8. Важные настройки Argo CD

Argo CD имеет настройки, которые позволяют управлять удалением ресурсов.

Prune=false

Запрещает автоматическое удаление ресурса при pruning.

yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-options: Prune=false


Это может быть полезно для критически важных ресурсов.

Однако приложение может оставаться OutOfSync.

Prune=confirm

Требует подтверждения перед удалением ресурса через pruning.

yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-options: Prune=confirm

Delete=false

Защищает ресурс от удаления при удалении Argo CD Application.

yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-options: Delete=false


Эти настройки решают разные задачи. Prune относится к удалению ресурсов, отсутствующих в Git, а Delete=false — к удалению ресурсов при удалении Application.

Они не заменяют резервное копирование и правильное управление жизненным циклом данных.

9. Важное правило

Никогда не удаляй CRD только потому, что Argo CD показывает Sync Failed.

Сначала установи причину ошибки.

Если нужно пересоздать Custom Resource, сначала изучи поведение конкретного Controller и последствия удаления.

Если нужно обновить CRD, делай это как отдельную операцию с проверкой совместимости и сохранности данных.

10. Вопросы для самопроверки
Чем удаление CR отличается от удаления CRD?
Что произойдёт с Custom Resources при удалении CRD?
Что такое Finalizer?
Почему объект может долго находиться в Terminating?
Почему удаление Database CR может привести к удалению PostgreSQL?
Почему удаление CR не гарантирует исправление ошибки Argo CD?
Чем отличаются Prune=false и Delete=false?
Как проверить, почему Argo CD не может создать Custom Resource?
11. Практический результат

Ты должен уметь безопасно диагностировать ошибки синхронизации Custom Resources и понимать последствия удаления CR, CRD и Controller.