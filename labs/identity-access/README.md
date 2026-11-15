# Lab: LDAP / OIDC / Kubernetes RBAC

Цель — научиться локализовать отказ по слоям, а не считать любую ошибку kubectl проблемой RBAC.

## Практический стенд: Keycloak + OpenLDAP

Начни с [hands-on лаборатории Keycloak + OpenLDAP](keycloak-openldap/README.md). Она поднимает изолированный локальный LDAP-каталог и Keycloak, подключает LDAP federation и проверяет импорт пользователя arsen и группы k8s-readers.

Это первый этап: HTTP используется только локально для UI и discovery. Не подключай его к Kubernetes. Следующий этап потребует HTTPS issuer, доверенной CA, OIDC client и кластера, где доступна настройка kube-apiserver authentication. Продолжение — [этап 2: OIDC login в kind и RBAC по LDAP-группе](keycloak-openldap/oidc-kubernetes.md).

## Сценарий 1 — 401 Unauthorized

Пользователь успешно проходит SSO в браузере, но kubectl get pods отвечает 401.

Порядок расследования:
1. kubectl config current-context — тот ли кластер?
2. kubectl config view --minify — какой user и exec plugin настроены? Не используй --raw в тикете.
3. Запусти credential plugin штатным способом и проверь его exit code/logs, не выводя token.
4. Убедись, что plugin выдаёт ID token для ожидаемого OIDC client.
5. Сравни безопасно декодированные claims: iss, aud, exp, sub, username и groups.
6. Проверь issuer URL, discovery/JWKS и TLS trust API Server.
7. Проверь синхронизацию времени.

Возможные причины: истёкший токен, неверная audience, issuer mismatch, недоступный JWKS, недоверенный CA, неверный client/plugin config.

## Сценарий 2 — 403 Forbidden

Пользователь входит успешно, но kubectl get pods -n payments отвечает 403.

~~~bash
kubectl auth whoami
kubectl auth can-i get pods -n payments
kubectl auth can-i get pods/log -n payments
kubectl get role,rolebinding -n payments
kubectl get clusterrole,clusterrolebinding
~~~

Проверь:
- распознанный username;
- группы, полученные от OIDC provider;
- group claim и protocol mapper в Dex/Keycloak;
- group prefix на API Server;
- точное совпадение subject в RoleBinding;
- namespace и нужные verbs/resources/subresources.

Не выдавай cluster-admin как диагностический workaround. Сначала найди минимально недостающее разрешение.

## Сценарий 3 — LDAP login failed

Если IdP не может проверить пользователя через LDAP/AD, иди от сети к приложению:

~~~bash
nslookup ldap.corp.example.com
nc -vz ldap.corp.example.com 636
~~~

Далее проверь TLS chain и hostname, bind DN/service account, base DN, user filter, group search, вложенные группы и ограничения поиска. Если используешь ldapsearch, передавай пароль через интерактивный -W, а не через -w. Не публикуй bind password и полные LDAP dumps.

## Сценарий 4 — группа добавлена, но доступа всё ещё нет

Возможные причины:
- новый group membership ещё не попал в token;
- IdP не разрешает nested groups;
- mapper выдаёт другой атрибут;
- пользователь использует старый ID token;
- RBAC binding ссылается на другое имя группы или prefix.

Попроси пользователя безопасно обновить login/token, проверь свежие claims и затем проверь RBAC. Не вставляй сам токен в онлайн JWT decoder.

## Таблица первичной классификации

| Наблюдение | Слой | Первое действие |
|---|---|---|
| Не открывается SSO | IdP / DNS / TLS | Проверить DNS, endpoint и IdP logs |
| SSO не принимает пароль | LDAP/AD или login policy | Проверить bind/search и состояние учётки |
| SSO успешен, API 401 | OIDC authentication | Проверить issuer/audience/signature/expiry |
| API 403 | Kubernetes authorization | Проверить identity, groups и RBAC |
| Часть пользователей без доступа | Group mapping | Сравнить claims и membership |
| Доступ пропал после ротации ключей | JWKS / signing keys | Проверить публикацию и обновление ключей |

## Что записать после лаборатории

- На каком слое возник отказ?
- Какой факт подтвердил гипотезу?
- Какие данные безопасно приложить к incident ticket?
- Как исправить проблему с минимальным радиусом воздействия?
- Как проверить восстановление с точки зрения пользователя?

Связанные заметки: [Identity & Access Management](../../Theory/17-identity-access/README.md), [RBAC](../../Theory/11-rbac/README.md).
