# OIDC и аутентификация в Kubernetes

## OAuth 2.0 и OpenID Connect — не одно и то же

- **OAuth 2.0** — framework делегированной авторизации: клиент получает access token для доступа к защищённому resource server.
- **OpenID Connect (OIDC)** — слой аутентификации поверх OAuth 2.0. Он определяет ID token и стандартные claims о пользователе.

Ключевое различие:
- ID token сообщает клиенту, кто аутентифицирован.
- Access token предназначен для доступа к API/resource server и не обязан быть пригоден для аутентификации пользователя в Kubernetes.

Для OIDC-аутентификации Kubernetes обычно использует **ID token**, выпущенный доверенным issuer.

## Что находится в ID token

JWT состоит из header, payload и signature. Это кодирование, а не шифрование: не помещай в claims секреты.

Типичные claims:
- `iss` — issuer, кто выпустил токен.
- `sub` — стабильный идентификатор субъекта у issuer.
- `aud` — audience, для кого выпущен токен.
- `exp` — expiration time.
- `iat` — issued at.
- `nbf` — not before (если присутствует).
- `email`, `preferred_username`, `groups` — дополнительные claims, если IdP их выпускает.

Токен подписан ключом IdP. API Server получает публичные ключи через OIDC discovery/JWKS и проверяет подпись и claims согласно своей конфигурации.

## Как Kubernetes использует OIDC

В типовой конфигурации self-managed control plane kube-apiserver настраивают параметрами OIDC, например:

```text
--oidc-issuer-url=https://sso.example.com/realms/platform
--oidc-client-id=kubernetes
--oidc-username-claim=preferred_username
--oidc-groups-claim=groups
--oidc-username-prefix=oidc:
--oidc-groups-prefix=oidc:
```

Это иллюстрация, а не готовая конфигурация: issuer URL, client ID и claims должны точно соответствовать настройкам Identity Provider. В managed Kubernetes эти параметры часто скрыты за настройками провайдера или интеграцией с его IAM.

- `issuer-url` — URL issuer, должен совпадать с claim `iss` и OIDC discovery.
- `client-id` — ожидаемая audience.
- `username-claim` — claim, используемый как Kubernetes username.
- `groups-claim` — claim со списком групп.
- prefixes — помогают избежать конфликтов с другими источниками identity.

Kubernetes API Server проверяет токен, но сам не выполняет интерактивный browser login. Обычно пользовательский kubectl credential plugin открывает браузер, получает ID token и возвращает его kubectl.

## kubeconfig и exec credential plugin

Упрощённый пример:

```yaml
users:
- name: corporate-user
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1
      command: kubectl-oidc_login
      args:
      - get-token
      - --oidc-issuer-url=https://sso.example.com/realms/platform
      - --oidc-client-id=kubernetes
```

Это демонстрационная форма: конкретный plugin, его параметры, версия API и способ регистрации клиента зависят от выбранного решения. Не копируй пример в рабочий kubeconfig без настройки IdP и plugin.

## Authentication и RBAC вместе

Допустим, ID token содержит:

```json
{
  "preferred_username": "arsen",
  "groups": ["platform-readers", "payments-support"]
}
```

После проверки токена API Server получает username и groups. Затем RBAC может сопоставить группу с Role:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: payments-readers
  namespace: payments
subjects:
- kind: Group
  name: oidc:payments-support
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

Значение subject должно точно совпасть с итоговым именем группы после применения настроек claim и prefix. Если prefix отключён, не добавляй его в RoleBinding.

Пример Role:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: payments
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
```

## Диагностика OIDC

Для 401:
1. Есть ли credential и возвращает ли exec plugin токен?
2. Не истёк ли `exp`; корректно ли системное время?
3. Совпадает ли `iss` с issuer URL?
4. Совпадает ли `aud` с client ID?
5. Доступен ли discovery/JWKS endpoint и доверяет ли API Server TLS-сертификату?
6. Корректна ли подпись и не сменились ли signing keys?

Для 403:
1. Какая identity видна через `kubectl auth whoami` (если версия и конфигурация поддерживают команду)?
2. Присутствует ли ожидаемая группа в claims?
3. Совпадают ли group prefix и subject в RoleBinding?
4. Есть ли binding в правильном namespace и разрешает ли Role нужный verb/resource?

Полезно:

```bash
kubectl config current-context
kubectl config view --minify
kubectl auth whoami
kubectl auth can-i get pods -n payments
kubectl auth can-i get pods/log -n payments
kubectl get role,rolebinding -n payments
```

Не публикуй kubeconfig, ID/access tokens, client secrets или вывод команд, содержащий credentials. Для анализа JWT используй только безопасно полученный тестовый токен; помни, что payload JWT читаем.

## Важные ограничения

- Встроенная OIDC-аутентификация kube-apiserver не заменяет полноценный user lifecycle и SSO портал.
- Изменение групп в каталоге обычно не переписывает уже выданный токен. Пользователю может потребоваться обновить токен.
- Группы в токене — claims от IdP; Kubernetes не ходит в LDAP за актуальными группами на каждый API request.
- OIDC — один из способов authentication, а RBAC — отдельный authorization layer.
- Kubernetes ServiceAccount tokens — другой механизм; не смешивай их с пользовательскими OIDC ID tokens.

Официально: [Kubernetes authentication](https://kubernetes.io/docs/reference/access-authn-authz/authentication/), [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html).
