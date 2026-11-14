# Dex и Keycloak

Dex и Keycloak часто встречаются в корпоративных Kubernetes-платформах, но это не одно и то же решение и не взаимозаменяемые названия LDAP/OIDC.

## Dex

Dex — OpenID Connect Identity Provider, который часто используют как identity broker между Kubernetes-клиентами и внешними системами идентификации.

Возможные upstream connectors зависят от версии и конфигурации Dex; среди распространённых вариантов — LDAP, Active Directory через LDAP, GitHub, SAML и другие OIDC providers.

Роль Dex:
1. Принять пользователя через настроенный connector.
2. Проверить identity через upstream-систему.
3. Сопоставить пользователя и группы.
4. Выдать собственные OIDC tokens как issuer.
5. Позволить Kubernetes API Server доверять одному стабильному OIDC issuer, а не каждому upstream источнику отдельно.

Схема:

```text
kubectl plugin -> Dex (OIDC issuer) -> LDAP / AD
                     |
                     +-> ID token (iss = Dex URL)
                              |
                              v
                       Kubernetes API Server
```

Важно: если Kubernetes настроен доверять Dex, в `iss` токена должен быть Dex issuer URL, а не URL LDAP/AD и не URL upstream identity provider.

## Keycloak

Keycloak — полноценная IAM/SSO-платформа. Он предоставляет:
- realms для разделения пространств пользователей и конфигураций;
- clients для приложений, которые используют Keycloak;
- users, groups, roles и identity brokering;
- OIDC и SAML;
- LDAP/Active Directory federation;
- управление сессиями, MFA, login flows и политиками.

Типовой поток:
1. В Keycloak создаётся realm, например `platform`.
2. Регистрируется OIDC client для Kubernetes login flow.
3. Настраиваются redirect URIs и client authentication согласно используемому kubectl plugin.
4. При необходимости подключается LDAP/AD federation.
5. Настраиваются protocol mappers, чтобы нужные username и groups попадали в ID token.
6. Kubernetes API Server конфигурируется доверять issuer realm, например `https://sso.example.com/realms/platform`.
7. Kubernetes RBAC связывает полученные группы с Role/ClusterRole.

Названия realm, client ID, redirect URI и claims здесь условные. Настройки должны совпасть между Keycloak, credential plugin и API Server.

## Dex vs Keycloak

| Критерий | Dex | Keycloak |
|---|---|---|
| Основная идея | Лёгкий OIDC broker/provider | Полноценная IAM/SSO платформа |
| LDAP/AD | Через connector | Через LDAP federation |
| Пользователи и группы | Часто источник — upstream | Может управлять локально и федеративно |
| SSO, MFA, login flows | Обычно опирается на upstream | Богатые встроенные возможности |
| OIDC issuer | Да | Да |
| Частое применение | Kubernetes login broker | Корпоративный IAM для множества приложений |

Это практическое сравнение по типичному применению; реальные возможности зависят от версии, настроек и архитектуры.

## Где настраивается доступ к Kubernetes

Разделяй ответственность:
- LDAP/AD хранит корпоративные учётные записи и группы.
- Dex/Keycloak аутентифицирует пользователя и выпускает токен.
- kubectl plugin получает/обновляет credential.
- kube-apiserver проверяет токен и извлекает identity.
- Kubernetes RBAC разрешает или запрещает действия.

Сам факт, что пользователь состоит в AD-группе `K8s-Admins`, не даёт ему автоматически cluster-admin. Нужны корректное отображение группы в token claim и соответствующий RoleBinding/ClusterRoleBinding.

## Что проверять при инциденте

### Пользователь не может войти
- доступность IdP и его DNS/TLS;
- доступность LDAP/AD connector;
- bind account, base DN и search filters;
- состояние учётной записи, пароль, MFA и login flow;
- redirect URI и client configuration.

### Вход успешный, kubectl возвращает 401
- ID token ли выдал plugin;
- `iss`, `aud`, `exp`;
- совпадение issuer URL в API Server;
- доступность OIDC discovery и JWKS;
- доверие к TLS сертификату IdP;
- не изменились ли signing keys.

### kubectl возвращает 403
- username и groups, которые видит Kubernetes;
- group claim/protocol mapper в Dex/Keycloak;
- вложенные группы и group search;
- prefix в API Server;
- точное имя subject в RoleBinding;
- namespace, resource, subresource и verb.

## Рекомендации для production

- Используй отдельные clients для разных приложений/кластеров там, где это упрощает аудит и изоляцию.
- Настраивай redirect URI максимально конкретно, не используй wildcard без необходимости.
- Защищай client secrets и LDAP bind credentials; ограничивай права service account.
- Настраивай TLS и ротацию сертификатов/ключей.
- Планируй поведение при недоступности IdP: существующие токены могут работать до истечения срока, но новые login/refresh могут быть невозможны.
- Продумай break-glass доступ с ограниченным кругом ответственных, безопасным хранением и аудитом; регулярно проверяй его.
- Мониторь ошибки login, LDAP connector, token issuance и доступность discovery/JWKS endpoints.

См. [LDAP и AD](ldap-active-directory.md), [OIDC в Kubernetes](oidc-kubernetes.md), [RBAC](../11-rbac/README.md).
Официальные проекты: [Dex](https://dexidp.io/docs/), [Keycloak](https://www.keycloak.org/documentation).
