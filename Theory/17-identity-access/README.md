# Identity & Access Management: LDAP, Active Directory, OIDC, Dex и Keycloak

Этот раздел объясняет, как корпоративная учётная запись превращается в identity, с которой пользователь обращается к Kubernetes API. Главная мысль: **каталог пользователей, Identity Provider, протокол аутентификации и Kubernetes RBAC — разные слои**.

## Карта компонентов

| Компонент | Что это | Основная роль |
|---|---|---|
| LDAP | Протокол доступа к каталогу | Найти пользователя, проверить bind, прочитать атрибуты и группы |
| Active Directory (AD) | Каталог и набор служб Microsoft | Централизованные учётные записи, группы, LDAP, Kerberos и политики домена |
| OIDC | Протокол идентификации поверх OAuth 2.0 | Передать приложению подписанный ID token с identity и claims |
| Dex | OIDC identity service / broker | Подключить внешний источник (LDAP, AD через LDAP, GitHub и др.) и выдать OIDC-токен |
| Keycloak | IAM / Identity Provider | SSO, пользователи, группы, роли, OIDC/SAML, federation к LDAP/AD |
| Kubernetes API Server | API и точка входа в кластер | Аутентифицировать запрос, затем авторизовать действие |

Упрощённо:

```text
Пользователь
    |
    v
kubectl / kubectl exec credential plugin
    |
    v
OIDC Provider (Dex или Keycloak)
    |
    +---- federation / LDAP connector ----> LDAP / Active Directory
    |
    v
подписанный ID token
    |
    v
Kubernetes API Server: проверка issuer, подписи, audience, срока действия
    |
    v
username + groups
    |
    v
RBAC: Role/ClusterRole + (Cluster)RoleBinding
    |
    v
разрешить или запретить API operation
```

Это типовая схема, а не единственная архитектура. Kubernetes может быть интегрирован с другим OIDC provider или внешним authenticator.

## Поток запроса в Kubernetes

1. Пользователь запускает `kubectl get pods -n payments`.
2. kubectl получает credential из kubeconfig: статический токен/сертификат или через `users[].user.exec` запускает credential plugin.
3. При OIDC-схеме plugin получает или обновляет ID token через Identity Provider. Часто пользователь проходит интерактивный SSO login.
4. API Server проверяет токен: issuer, подпись по ключам провайдера, audience/client ID, срок действия и необходимые claims.
5. Из токена извлекаются username и groups.
6. Authorizer (например, RBAC) проверяет, разрешено ли этой identity выполнить verb над resource в указанном namespace.
7. Клиент получает ответ API: например, 200, 401 или 403.

**Authentication отвечает «кто ты?», authorization — «что тебе разрешено?».** Успешный вход не означает, что пользователь имеет доступ ко всем namespace или ресурсам.

## LDAP и Active Directory

Подробности: [LDAP и Active Directory](ldap-active-directory.md).

## OIDC

Подробности: [OIDC и Kubernetes API Server](oidc-kubernetes.md).

## Dex и Keycloak

Подробности: [Dex и Keycloak](dex-keycloak.md).

## Authentication vs Authorization: как читать ошибки

| Симптом | Вероятный слой | Что проверить |
|---|---|---|
| `Unauthorized` / HTTP 401 | Authentication | Есть ли credential, не истёк ли токен, issuer/audience/signature, время на узлах |
| `Forbidden` / HTTP 403 | Authorization | Какая identity распознана, groups, Role/ClusterRole и bindings, namespace, verb/resource |
| Login прошёл, но нет нужных групп | Mapping / claims | LDAP group search, group claim в ID token, scopes, настройки Dex/Keycloak |
| Работает в одном кластере, но не в другом | Cluster OIDC config | issuer URL, client ID/audience, CA trust, username/group claim и prefixes |
| После смены группы доступ не обновился | Token lifecycle | Содержимое уже выданного токена, срок жизни, refresh/re-login и кэширование |

Полезные команды:

```bash
kubectl auth whoami
kubectl auth can-i get pods -n payments
kubectl auth can-i list secrets -n payments
kubectl get role,rolebinding -n payments
kubectl get clusterrole,clusterrolebinding
kubectl config view --minify
```

Осторожно: `kubectl config view --raw` может показать секреты и токены. Не вставляй такой вывод в тикеты и не коммить его.

## Безопасность и production considerations

- Используй TLS для LDAP (LDAPS или StartTLS) и доверенную цепочку сертификатов.
- Предпочитай OIDC SSO вместо раздачи пользователям общих kubeconfig с долгоживущими credentials.
- Не путай ID token для аутентификации клиента с OAuth access token для доступа к API провайдера.
- Ограничивай claims и группы: не передавай в токен огромные списки вложенных групп без необходимости.
- Выдавай Kubernetes RBAC по принципу least privilege; не связывай широкую доменную группу с `cluster-admin` без обоснования.
- Учитывай задержку распространения изменений групп и срок жизни уже выданного токена.
- Синхронизируй время (NTP): рассинхронизация может ломать проверку `iat`/`nbf`/`exp`.
- Не храни client secret, LDAP bind password, private key и реальные токены в Git.

## Что важно запомнить

- LDAP — протокол, AD — каталог/службы, OIDC — протокол identity, Dex/Keycloak — identity provider / broker.
- Kubernetes не превращается в LDAP-клиент автоматически: обычно LDAP/AD подключается к Dex или Keycloak, а Kubernetes доверяет OIDC issuer.
- После успешной authentication доступ всё равно определяется RBAC.
- Kubernetes ServiceAccount — отдельная identity для workload внутри кластера; это не пользовательская AD-учётная запись.

## Практика и связанные темы

- [Лаборатория диагностики Authentication и RBAC](../../labs/identity-access/README.md)
- [RBAC и ServiceAccounts](../11-rbac/README.md)
- [Kubernetes authentication](https://kubernetes.io/docs/reference/access-authn-authz/authentication/)
- [OIDC authentication](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#openid-connect-tokens)
- [LDAP](https://www.rfc-editor.org/rfc/rfc4511)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
