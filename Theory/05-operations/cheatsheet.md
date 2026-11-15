# Шпаргалка команд kubectl

Здесь собраны команды, которые ты будешь использовать в 90% случаев на проде.

## 🔍 Просмотр ресурсов (Get)
Всегда используй флаг `-o wide`, чтобы видеть IP и на какой ноде работает под.

* `kubectl get pods` — все поды в текущем namespace.
* `kubectl get pods -n production` — поды в конкретном namespace.
* `kubectl get pods -o wide` — + IP-адрес и имя ноды.
* `kubectl get pods -w` — "смотреть" в реальном времени (как `tail -f`). Полезно, когда ждешь запуска пода.
* `kubectl get all` — краткий обзор части основных ресурсов (Pods, Services, Deployments и др.); это не буквально все типы ресурсов и не включает, например, Secrets/PVC по умолчанию.
* `kubectl get events -A --sort-by='.metadata.creationTimestamp'` — события всех namespace, отсортированные по времени создания объекта Event. Это полезный срез, но не полноценная история инцидента: сверяй timestamps и метрики системы мониторинга.

## 🕵️ Диагностика (Describe & Logs)
Это твой главный инструмент, когда что-то сломалось.

* `kubectl describe pod <имя-пода>` — покажет подробную инфу о поде: какие образы, какие тома, и главное — **Events (События)** в самом низу (там пишутся ошибки запуска).
* `kubectl logs <имя-пода>` — логи приложения.
* `kubectl logs <имя-пода> -c <имя-контейнера>` — если в поде несколько контейнеров (например, основной и sidecar).
* `kubectl logs <имя-пода> --previous` — логи **предыдущего** контейнера. Спасает, если под упал (CrashLoopBackOff) и вы не успели посмотреть логи текущего.

## ⚙️ Управление (Apply & Delete)

> `apply`, `delete`, `scale` и `rollout undo` изменяют состояние кластера. Перед запуском проверь context, namespace и объект. Для предварительного просмотра используй `kubectl diff -f file.yaml`; для серверной проверки без сохранения — `kubectl apply --dry-run=server -f file.yaml` (если API и admission webhooks поддерживают dry-run).

* `kubectl apply -f file.yaml` — применить манифест (создать или обновить).
* Для каталога приложения сначала создай namespace, затем применяй каталог: `kubectl apply -f Manifests/payments-api/namespace.yaml && kubectl apply -f Manifests/payments-api/`. Не полагайся на порядок файлов в директории. Каталог `Manifests/` целиком не применяй: там лежат сломанные `incidents/`.
* `kubectl delete -f file.yaml` — удалить ресурс, описанный в файле.
* `kubectl delete pod <имя-пода>` — удалить под вручную.

## 🚀 Отладка и Rollout (Обновления)

* `kubectl rollout status deployment/<имя>` — "зависнуть" и смотреть, как проходит обновление (раскатка) деплоймента.
* `kubectl rollout undo deployment/<имя>` — откатить деплоймент на предыдущую версию (если новая версия сломалась).
* `kubectl scale deployment/<имя> --replicas=5` — изменить количество реплик.

## 🚪 Доступ внутрь (Exec & Port-forward)

* `kubectl exec -it <имя-пода> -- sh` (или `-- bash`) — зайти внутрь контейнера (как `docker exec`).
* `kubectl port-forward <имя-пода> 8080:80` — пробросить порт с вашего ноутбука в под (очень полезно для тестов, когда сервис не доступен извне).

## 🎯 Хитрости и лайфхаки

* **Генерация YAML**: Если не хочешь писать YAML с нуля, используй `--dry-run=client -o yaml`. 
  Пример: `kubectl run my-nginx --image=nginx --dry-run=client -o yaml > pod.yaml` (создаст шаблон пода, но не запустит его).
* **Быстрый временный под**: Если нужен под с утилитами (например, `curl`), чтобы проверить сеть:
  `kubectl run tmp -n <namespace> --rm -it --restart=Never --image=busybox:1.36 --command -- sh`

## Связанные заметки

- Алгоритм отладки: [[kubectl-debug]]
- Как kubectl работает под капотом: [[how-kubectl-works]]
- Трек обучения: [[Theory/00-overview/learning-path]]