# Этап 2: OIDC login в Kubernetes и RBAC по группе

Этот этап продолжает [первую практику Keycloak + OpenLDAP](README.md). Он использует уже созданные realm `k8s-lab`, LDAP user `arsen` и группу `/k8s-readers`. Если первый этап ещё не пройден, сначала выполни его и убедись, что пользователь виден в Keycloak и состоит в группе.

## Что соберём

```text
Browser / kubectl oidc-login
          | Authorization Code + PKCE
          v
https://sso.iam.test:8443/realms/k8s-lab
          | ID token: iss, aud, preferred_username, groups
          v
kind kube-apiserver (OIDC flags + trusted local CA)
          | username=oidc:arsen
          | group=oidc:k8s-readers
          v
RoleBinding -> Role pod-reader -> pods, pods/log in namespace iam-lab
```

## Prerequisites и ограничения

- Пройден этап 1: Keycloak и OpenLDAP запущены, пользователь `arsen` импортирован, пароль задан, членство в `/k8s-readers` подтверждено.
- Docker Engine или Docker Desktop с Compose v2; здесь используется Docker provider для kind.
- kind `v0.33.0`, kubectl `v1.35.x`, `mkcert` и плагин [int128/kubelogin](https://github.com/int128/kubelogin). На Windows плагин можно установить через Chocolatey (`choco install kubelogin`), на macOS/Linux — через Krew (`kubectl krew install oidc-login`) или официальный release.
- Свободные локальные TCP-порты `8443`, `8080`, `1389`; `kubelogin` использует loopback callback `8000` и резервный `18000`.
- Доступ к registry для загрузки kind node image и тестового `pause` image.

Это одноузловой disposable kind-кластер. Он позволяет менять kube-apiserver через kubeadm config patch. Не применяй этот файл к существующему или production-кластеру. В managed Kubernetes пользователь обычно не может напрямую менять аргументы kube-apiserver: используй только поддерживаемую провайдером OIDC/IAM-интеграцию. Если провайдер не предоставляет такую возможность, эта схема не переносится простым добавлением флагов.

Для Kubernetes OIDC issuer обязан быть HTTPS, а сертификат должен быть подписан CA, которому доверяет API Server. В этом упражнении mkcert создаёт отдельный локальный CA. HTTP на `localhost:8080` остаётся только для первого этапа; OIDC issuer будет HTTPS на `sso.iam.test:8443`. Никаких `--insecure-skip-tls-verify` и отключения TLS-проверок.

Если ты уже запускал предыдущую версию Stage 1 до добавления `KC_PROXY_HEADERS`, не обновляй Compose вслепую: изменение environment пересоздаст Keycloak container и сбросит его dev-file realm state. Сначала экспортируй realm/users или будь готов заново создать realm и LDAP federation. После применения новой базовой конфигурации Stage 2 overlay не пересоздаёт Keycloak.

## Этап 2.1 — выпустить локальный сертификат

Работай из каталога `labs/identity-access/keycloak-openldap`.

Установи mkcert и создай локальный CA. На Windows можно выполнить `choco install mkcert`, затем открыть PowerShell с правами администратора для установки CA в доверенное хранилище:

~~~powershell
mkcert -install
New-Item -ItemType Directory -Force certs | Out-Null
mkcert -cert-file certs/sso.iam.test.pem -key-file certs/sso.iam.test-key.pem sso.iam.test
$caRoot = (mkcert -CAROOT).Trim()
Copy-Item (Join-Path $caRoot "rootCA.pem") certs/rootCA.pem -Force
git check-ignore certs/rootCA.pem certs/sso.iam.test.pem certs/sso.iam.test-key.pem
~~~

Последняя команда должна показать, что все три файла игнорируются Git. Не добавляй CA private key или TLS private key в репозиторий. Для Linux/macOS команды аналогичны; `mkcert -install` устанавливает CA в локальное trust store.

Добавь в системный hosts-файл одну строку (на Windows: `C:\Windows\System32\drivers\etc\hosts`, редактор запусти от администратора):

~~~text
127.0.0.1 sso.iam.test
~~~

Если запись уже есть, не добавляй дубликат. На Linux/macOS файл — `/etc/hosts`. Имя намеренно разрешается по-разному: браузер на компьютере получает `127.0.0.1`, а контейнеры kind — Docker network alias прокси-контейнера.

## Этап 2.2 — включить HTTPS issuer

Kind по умолчанию использует Docker network `kind`. Создай её заранее, только если её ещё нет. Не удаляй сеть: она может использоваться другими kind-кластерами.

~~~powershell
$kindNetwork = docker network ls --format "{{.Name}}" | Where-Object { $_ -eq "kind" }
if (-not $kindNetwork) { docker network create kind }
~~~

Подними reverse proxy поверх уже работающего Keycloak:

~~~powershell
docker compose -f docker-compose.yml -f compose.oidc.yml config
docker compose -f docker-compose.yml -f compose.oidc.yml up -d
docker compose -f docker-compose.yml -f compose.oidc.yml ps
~~~

Caddy подключён к двум Docker networks: `iam` (для доступа к Keycloak по `keycloak:8080`) и `kind` (для доступа API Server к issuer по DNS alias `sso.iam.test`). Host port `8443` привязан только к `127.0.0.1`. Базовый Compose уже задаёт `KC_PROXY_HEADERS=xforwarded` и `KC_HOSTNAME_STRICT=false`: Caddy передаёт `X-Forwarded-Host` и `X-Forwarded-Proto`, поэтому Keycloak формирует внешний HTTPS issuer из запроса. Overlay не меняет environment Keycloak и не должен пересоздавать его контейнер — это важно, потому что dev-file realm хранится в writable layer. Динамические hostname/forwarded headers небезопасны для публичного сервиса; здесь они допустимы только в изолированном disposable стенде с loopback-публикацией и доверенным локальным Caddy.

Проверь discovery и TLS с хоста:

~~~powershell
curl.exe --fail --show-error --cacert certs/rootCA.pem https://sso.iam.test:8443/realms/k8s-lab/.well-known/openid-configuration
~~~

Ожидаемый результат — JSON, где `issuer` в точности равен `https://sso.iam.test:8443/realms/k8s-lab`, а `jwks_uri` использует тот же HTTPS hostname. При `connection refused` проверь `docker compose ... ps` и логи `docker compose ... logs --tail=100 oidc-proxy keycloak`. При `x509` проверь, что `rootCA.pem` — CA из `mkcert -CAROOT`, а leaf certificate выпущен для `sso.iam.test`.

## Этап 2.3 — создать OIDC client и claims в Keycloak

Открой `https://sso.iam.test:8443`, выбери realm `k8s-lab`.

1. В **Clients** создай client с Client ID `kubernetes`, protocol `OpenID Connect`.
2. Отключи **Client authentication** (public client), включи **Standard flow**. Direct access grants, implicit flow и service accounts для этого упражнения не нужны.
3. В настройках клиента установи Proof Key for Code Exchange (PKCE) method `S256`, если поле доступно в текущей версии.
4. В **Valid redirect URIs** добавь точные loopback callbacks `http://localhost:8000` и `http://localhost:18000`. Это локальные адреса kubelogin на твоём компьютере, не публичные redirect URI. Web origins для этого server-side redirect flow можно оставить пустыми.
5. Убедись, что client использует стандартный scope `profile`: он добавляет `preferred_username` в ID token. Если claim отсутствует, проверь effective client scopes и mapper `username` → `preferred_username`.
6. Открой dedicated client scope клиента `kubernetes`, затем **Mappers → Add mapper → By configuration → Group Membership**.
7. Настрой mapper: Name `groups`, Token Claim Name `groups`, Full group path `OFF`, Add to ID token `ON`. Add to access token можно включить для диагностики, но Kubernetes будет использовать ID token.
8. Убедись в Users → `arsen` → Groups, что пользователь состоит в `/k8s-readers`.

Ожидаемые claims ID token (значения `sub`, timestamps и подпись будут другими):

~~~json
{
  "iss": "https://sso.iam.test:8443/realms/k8s-lab",
  "aud": "kubernetes",
  "preferred_username": "arsen",
  "groups": ["k8s-readers"],
  "exp": 0
}
~~~

Это структура для проверки, а не токен для копирования. JWT payload кодирован, но не зашифрован; не публикуй токен и не вставляй его в онлайн decoder.

## Этап 2.4 — создать отдельный kind-кластер с OIDC flags

В `kind/oidc-kind.yaml` уже зафиксирован node image `v1.35.8` по digest. Запускай создание из каталога этой лаборатории, чтобы относительный `hostPath` сертификата разрешился корректно:

~~~powershell
kind version
kubectl version --client
kind create cluster --name iam-oidc-lab --config kind/oidc-kind.yaml --wait 5m
kubectl cluster-info --context kind-iam-oidc-lab
~~~

Конфигурация монтирует локальный CA внутрь control-plane node и передаёт kube-apiserver флаги `--oidc-issuer-url`, `--oidc-client-id`, `--oidc-username-claim`, `--oidc-groups-claim`, prefixes и `--oidc-ca-file` через kubeadm `ClusterConfiguration.apiServer.extraArgs`. При старте API Server issuer уже доступен по Docker network `kind`.

Проверь, что control-plane видит DNS alias и файл CA:

~~~powershell
docker exec iam-oidc-lab-control-plane getent hosts sso.iam.test
docker exec iam-oidc-lab-control-plane test -s /etc/kubernetes/pki/oidc-root-ca.pem
~~~

Первая команда должна вернуть IP Caddy-контейнера, вторая завершиться без ошибки. Если `getent` не находит имя, проверь `docker network inspect kind` и наличие `iam-oidc-proxy` в списке контейнеров этой сети.

## Этап 2.5 — подготовить минимальный RBAC

Применяй ресурсы административным kind context, не OIDC-пользователем:

~~~powershell
kubectl --context kind-iam-oidc-lab apply -f kubernetes/rbac.yaml
kubectl --context kind-iam-oidc-lab apply -f kubernetes/demo-pod.yaml
kubectl --context kind-iam-oidc-lab get pods -n iam-lab -w
~~~

Ожидается namespace `iam-lab`, Role `pod-reader`, RoleBinding `pod-readers` для группы `oidc:k8s-readers` и Pod `iam-demo` в состоянии Running. Role разрешает только `get/list/watch` для `pods` и чтение `pods/log` в namespace `iam-lab`; никаких cluster-wide прав и доступа к Secrets нет.

## Этап 2.6 — настроить kubelogin и kubeconfig

Установи plugin и проверь, что kubectl его видит:

~~~powershell
kubectl oidc-login --help
~~~

Сначала выполни отдельную проверку Authorization Code + PKCE. Она откроет браузер, после входа покажет claims ID token:

~~~powershell
kubectl oidc-login setup --grant-type=authcode --oidc-issuer-url=https://sso.iam.test:8443/realms/k8s-lab --oidc-client-id=kubernetes --oidc-extra-scope=profile --oidc-pkce-method=S256 --certificate-authority=certs/rootCA.pem
~~~

Войди как LDAP user `arsen`. Проверь `iss`, `aud`, `preferred_username` и `groups`; не копируй токен в чат или тикет.

Добавь отдельную OIDC identity в kubeconfig. Команда не перезаписывает admin context `kind-iam-oidc-lab`:

~~~powershell
$caPath = (Resolve-Path certs/rootCA.pem).Path
$caArg = "--certificate-authority=$caPath"
kubectl config set-credentials oidc-arsen `
  --exec-command=kubectl `
  --exec-api-version=client.authentication.k8s.io/v1 `
  --exec-interactive-mode=IfAvailable `
  --exec-arg=oidc-login `
  --exec-arg=get-token `
  --exec-arg=--grant-type=authcode `
  --exec-arg=--oidc-issuer-url=https://sso.iam.test:8443/realms/k8s-lab `
  --exec-arg=--oidc-client-id=kubernetes `
  --exec-arg=--oidc-extra-scope=profile `
  --exec-arg=--oidc-pkce-method=S256 `
  "--exec-arg=$caArg"

kubectl config set-context iam-oidc-user --cluster=kind-iam-oidc-lab --user=oidc-arsen --namespace=iam-lab
kubectl config use-context iam-oidc-user
~~~

Если у тебя kubeconfig хранится не в стандартном месте, сначала установи нужный `$env:KUBECONFIG`. Не публикуй kubeconfig: в нём остаются admin credentials kind-кластера.

## Этап 2.7 — проверить authentication и authorization

Первый вызов запустит браузерный login, последующие используют cache kubelogin:

~~~powershell
kubectl auth whoami -o yaml
kubectl auth can-i get pods -n iam-lab
kubectl auth can-i get pods/log -n iam-lab
kubectl get pods -n iam-lab
~~~

Ожидается identity `oidc:arsen`, группа `oidc:k8s-readers`, `yes` для чтения Pod и `iam-demo` в списке. API Server извлекает username/groups из ID token, а RBAC отдельно проверяет разрешения.

Проверь, что ограничения действительно работают:

~~~powershell
kubectl auth can-i get secrets -n iam-lab
kubectl auth can-i get pods -n kube-system
kubectl auth can-i get nodes
kubectl get secrets -n iam-lab
~~~

Первые три проверки должны вернуть `no`; последняя — `Forbidden` / HTTP 403. Это ожидаемый отказ authorization, а не неисправность OIDC. Не исправляй его выдачей `cluster-admin`.

## Troubleshooting

### 401 Unauthorized

- Убедись, что текущий context — `iam-oidc-user`, plugin установлен и browser login завершился без ошибки.
- В claims проверь точное совпадение `iss` с `--oidc-issuer-url`, наличие `kubernetes` в `aud`, актуальный `exp`, а также `preferred_username` и `groups`.
- Выполни `curl.exe --cacert certs/rootCA.pem https://sso.iam.test:8443/realms/k8s-lab/.well-known/openid-configuration`; discovery должен вернуть тот же issuer.
- Проверь `docker exec iam-oidc-lab-control-plane getent hosts sso.iam.test` и наличие CA по пути `/etc/kubernetes/pki/oidc-root-ca.pem`.
- В этом dev-профиле `KC_HOSTNAME` намеренно не задан: `KC_HOSTNAME_STRICT=false` и `KC_PROXY_HEADERS=xforwarded` позволяют Keycloak взять внешний host/scheme из заголовков локального Caddy. Discovery `issuer` не должен содержать `localhost` или HTTP.
- Убедись, что используется ID token, а не access token; не включай `--oidc-use-access-token`.
- Проверь системное время хоста и API Server. При необходимости изучи логи static pod через `docker exec iam-oidc-lab-control-plane crictl ps --name kube-apiserver`, затем `crictl logs <container-id>`.

Типичные причины: issuer mismatch, audience mismatch, истёкший token, недоверенный CA, неверный hostname/SAN, недоступный discovery/JWKS, отсутствующий credential plugin или рассинхронизация времени.

### 403 Forbidden

- Если `kubectl auth whoami -o yaml` показывает ожидаемые `oidc:arsen` и `oidc:k8s-readers`, authentication уже работает: исследуй RBAC.
- В Keycloak проверь LDAP group mapper и членство `arsen` в `/k8s-readers`; в OIDC Group Membership mapper — claim `groups` и Full group path `OFF`.
- В RoleBinding subject должен быть ровно `oidc:k8s-readers`. Если включён Full group path, claim может быть `/k8s-readers`, и subject надо осознанно согласовать с ним.
- Убедись, что RoleBinding находится в `iam-lab`, а Role разрешает нужный verb/resource. RoleBinding в namespace не даёт доступ к `kube-system`, Nodes или Secrets.
- После изменения membership/mapper очисти только cache kubelogin командой `kubectl oidc-login clean` и пройди login заново: уже выданный ID token не обновляет groups задним числом.

### Другие ошибки

| Симптом | Что проверить |
|---|---|
| `redirect_uri` mismatch | В client `kubernetes` разрешены оба localhost callback: 8000 и 18000 |
| `x509: certificate signed by unknown authority` | `rootCA.pem` установлен на хосте, смонтирован в kind и указан в `--oidc-ca-file` / kubelogin |
| `no such host` внутри API Server | Caddy подключён к Docker network `kind` с alias `sso.iam.test` |
| `502 Bad Gateway` | Keycloak завершил старт; проверь `docker compose ... logs keycloak oidc-proxy` |
| В claims нет groups | LDAP group mapper, membership DN, client Group Membership mapper и Add to ID token |

## Что должно получиться

- [ ] LDAP user `arsen` входит в `/k8s-readers`.
- [ ] Keycloak discovery доступен по HTTPS, `issuer` совпадает с URL в kube-apiserver.
- [ ] ID token содержит `preferred_username=arsen` и `groups=["k8s-readers"]`.
- [ ] `kubectl auth whoami` показывает `oidc:arsen` и `oidc:k8s-readers`.
- [ ] В `iam-lab` можно читать Pod и Pod logs.
- [ ] Secrets, другие namespace и cluster-scoped Nodes запрещены.

## Уборка

Верни административный context и удали только созданный учебный кластер:

~~~powershell
kubectl config use-context kind-iam-oidc-lab
kind delete cluster --name iam-oidc-lab
~~~

Не удаляй Docker network `kind`, если она используется другими кластерами. `docker compose down` удаляет Keycloak container и его dev-file state; LDAP named volumes сохраняются. Полный сброс LDAP через `docker compose down -v` выполняй только если действительно хочешь удалить данные этого учебного каталога.

## Почему это не переносится напрямую в managed Kubernetes

В kind kube-apiserver создаётся kubeadm, поэтому мы можем передать ему `--oidc-*` при создании кластера. В managed Kubernetes control plane принадлежит провайдеру. Используй документированный механизм конкретного сервиса: OIDC/IAM integration, identity center или внешний authenticator. Не пытайся редактировать control-plane node или применять этот kind config к managed/production cluster.

В Kubernetes `v1.34+` также доступен стабильный `AuthenticationConfiguration` через `--authentication-config`. Здесь намеренно используются классические `--oidc-*` flags, чтобы увидеть прямое соответствие issuer/client/claims. Не задавай `--authentication-config` одновременно с этими флагами.

## Официальная документация

- [Kubernetes authentication / OIDC](https://kubernetes.io/docs/reference/access-authn-authz/authentication/)
- [kind configuration: extraMounts and kubeadmConfigPatches](https://kind.sigs.k8s.io/docs/user/configuration/)
- [kind releases and compatible node images](https://github.com/kubernetes-sigs/kind/releases)
- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [Keycloak protocol mappers](https://www.keycloak.org/admin-api/protocol-mappers)
- [kubelogin usage and authentication flows](https://github.com/int128/kubelogin/blob/master/docs/usage.md)
