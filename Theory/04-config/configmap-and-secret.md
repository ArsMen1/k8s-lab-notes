# ConfigMap и Secret

Правило: **образ не должен содержать окружение-специфичную конфигурацию**. Меняется конфиг — не пересобираешь image.

## ConfigMap

Хранит несекретные данные: URL БД, feature flags, nginx.conf, уровень логов.

Способы доставки в под:

1. **env** / `envFrom` — переменные окружения
2. **volumeMount** — файлы в директории

## Secret

То же API-ощущение, но для чувствительных данных: пароли, токены, TLS-ключи.

Важно:

- В etcd Secret по умолчанию лежит как **base64**, это не шифрование.
- Шифрование at-rest включают отдельно на API Server.
- В Git лучше класть только учебные примеры / sealed-secrets / внешний secret manager. Не коммитьте прод-пароли.

## Типичный паттерн

```yaml
env:
  - name: APP_MODE
    valueFrom:
      configMapKeyRef:
        name: payments-api
        key: APP_MODE
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: payments-api
        key: DB_PASSWORD
```

Практика: `Manifests/payments-api/configmap.yaml` и `Manifests/payments-api/secret.yaml`. Deployment, который их читает, лежит отдельно: `Manifests/payments-api/deployment.yaml`.

## Под капотом

1. Ты создаешь ConfigMap/Secret → они попадают в etcd.
2. При старте пода kubelet монтирует данные в контейнер.
3. Если ConfigMap изменился:
   - файлы в volume обычно обновятся (с задержкой);
   - переменные окружения **не обновятся**, пока под не пересоздан.

Поэтому многие делают: изменить ConfigMap → `kubectl rollout restart deployment/...`

## Полезные команды

```bash
kubectl create configmap payments-config --from-literal=APP_MODE=lab
kubectl create secret generic payments-secret --from-literal=DB_PASSWORD=pass
kubectl get configmap payments-config -o yaml
kubectl describe secret payments-secret
```

## Связанные заметки

- Namespace isolation: [[namespaces]]
- Rolling restart: [[rolling-update]]
