# K8s Lab Notes

Конспект Kubernetes и лаборатория поломок. Теория объясняет, из чего кластер собран. Манифесты показывают, как это лежит в git. Лаборатория проверяет, можешь ли ты по симптомам дойти до причины.

## Как зайти

1. [Проверка уровня](labs/00-level-check.md) — семь вопросов. Ответов рядом нет. Если завис, там ссылка на нужную заметку.
2. [Первая неделя в «Сдаче»](labs/incidents.md) — семь инцидентов. Сначала кластер, потом разбор в `labs/debrief/`.
3. Теорию целиком, если хочется карты, а не пожара: [`Theory/00-overview/learning-path.md`](Theory/00-overview/learning-path.md).

## Структура

```text
Theory/                 заметки, по трекам
  00-overview/          что такое кластер, глоссарий, трек, открытые вопросы
  01-workloads/         Pod, Deployment, DaemonSet, пробы, rollout
  02-networking/        Service, Endpoints, путь пакета, Ingress
  03-scheduling/        taints, tolerations, affinity
  04-config/            ConfigMap, Secret, 12 факторов, Spring Config
  05-operations/        kubectl, образы, порядок apply
  06-organization/      namespace и labels
Manifests/              желаемое состояние, один kind на файл
  payments-api/         рабочий сервис
  config-server/        config server
  echo/                 сервис в отдельном namespace
  incidents/            специально сломанные сценарии 01–07
labs/                   уровень, история инцидентов, разборы отдельно
```

Карта каталога манифестов: [`Manifests/README.md`](Manifests/README.md).

## Быстрый старт

Нужен любой кластер: Killercoda, minikube, kind.

```bash
git clone https://github.com/ArsMen1/k8s-lab-notes.git
cd k8s-lab-notes

kubectl apply -f Manifests/payments-api/
kubectl apply -f Manifests/config-server/
kubectl apply -f Manifests/echo/

kubectl -n payments get deploy,rs,pods,svc
```

`kubectl apply -f Manifests/` целиком не запускай. Внутри `incidents/` лежат поломки, их применяют по номеру дня из истории.

Снаружи учебный NodePort:

```bash
kubectl apply -f Manifests/payments-api/service-nodeport.yaml
```

Порт 30080. В проде этого файла нет, снаружи ходят через Ingress или балансировщик.

## Как вести конспект

1. Одна тема — одна заметка, ссылки между ними через `[[wiki-links]]`.
2. В конце заметки — несколько строк, что увидел в кластере.
3. В git только желаемое состояние. Endpoints, статусы подов и настоящие пароли не коммитят.
