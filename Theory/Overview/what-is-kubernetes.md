# Что такое Kubernetes?

Kubernetes (K8s) — это платформа для оркестрации контейнеров. Если сказать проще: это «операционная система для дата-центра». 
Вы говорите ему *что* вы хотите запустить (желаемое состояние), а он делает всё, чтобы это *работало* (текущее состояние), автоматически восстанавливая упавшие компоненты.

## Главная философия (Декларативность)
Вы не пишете скрипты типа «запусти контейнер, а если упадет — перезапусти». Вы пишете YAML-файл: «Я хочу, чтобы всегда работало 3 копии Nginx». Kubernetes (его контроллеры) сам следит за этим.

## Из чего состоит кластер?
1. **Control Plane (Мозг)** — управляет кластером (API Server, etcd, Scheduler, Controller Manager). Сюда мы шлем команды через `kubectl`.
2. **Worker Nodes (Мышцы)** — серверы, где реально работают ваши контейнеры (Kubelet, Kube-proxy, Container Runtime).

## Карта терминов (С чего начать изучение)
Здесь собраны базовые сущности Kubernetes. Изучай их в этом порядке:
1. [[glossary-core-objects#Pod|Pod]] — атомарная единица (контейнер).
2. [[glossary-core-objects#ReplicaSet|ReplicaSet]] — следит за количеством подов.
3. [[glossary-core-objects#Deployment|Deployment]] — управляет ReplicaSet (обновления, откаты).
4. [[glossary-core-objects#Service|Service]] — дает подам стабильный IP и DNS.

Полный трек (что дальше и в каком порядке): [[learning-path]]

## Связанные глубокие темы:
* Разница между Deployment и ReplicaSet: [[deployment-vs-replicaset]]
* Labels и Selectors: [[labels-and-selectors]]
* Зачем нужны Сервисы: [[why-service]]
* Откуда берутся образы: [[where-is-nginx-from]]
* Порядок применения манифестов: [[order-of-manifests]]
* Как дебажить: [[kubectl-debug]]