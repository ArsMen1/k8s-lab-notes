# LDAP и Active Directory

## LDAP — что это

LDAP (Lightweight Directory Access Protocol) — протокол для обращения к directory service: иерархическому каталогу объектов, например пользователей, групп, компьютеров и организационных подразделений.

LDAP — не база данных общего назначения и не система управления Kubernetes-доступом. Это стандартный способ искать и читать записи каталога, а также выполнять bind и другие операции.

Типичные операции:
- **Bind** — установить LDAP-сеанс и аутентифицироваться (simple bind или SASL).
- **Search** — искать записи по base DN, scope и filter.
- **Compare** — проверить значение атрибута.
- **Modify** — изменить атрибуты, если у клиента есть права.
- **Unbind** — завершить LDAP-сеанс.

## Структура каталога

Пример Distinguished Name (DN):

```text
CN=Arsen Osipov,OU=Engineering,DC=corp,DC=example,DC=com
```

- `CN` — Common Name, имя объекта.
- `OU` — Organizational Unit, контейнер/организационная единица.
- `DC` — Domain Component, компоненты доменного имени.
- DN — полный путь к записи в дереве каталога.
- Base DN — точка, от которой начинается поиск.
- RDN — относительное имя записи относительно родителя.

Пример LDAP-фильтров:

```ldap
(uid=arsen)
(&(objectClass=person)(uid=arsen))
(&(objectCategory=person)(sAMAccountName=arsen))
(memberOf=CN=k8s-readers,OU=Groups,DC=corp,DC=example,DC=com)
```

Атрибуты зависят от каталога и схемы. В AD часто встречаются `sAMAccountName`, `userPrincipalName`, `memberOf`, `objectGUID`; в других LDAP-каталогах могут использоваться `uid`, `cn`, `mail`, `uidNumber`, `gidNumber`.

## Active Directory

Active Directory Domain Services (AD DS) — служба каталогов Microsoft для корпоративного домена. AD хранит учётные записи пользователей, компьютеров и групп, поддерживает политики и доменную инфраструктуру.

AD использует несколько протоколов и механизмов:
- LDAP/LDAPS — запросы к каталогу и операции с записями.
- Kerberos — сетевой протокол аутентификации, широко используемый в домене.
- DNS — обнаружение контроллеров домена и сервисов.
- Group Policy — централизованное применение настроек к доменным компьютерам и пользователям.

Следовательно, **Active Directory — не синоним LDAP**. LDAP — один из протоколов взаимодействия с AD; Kerberos — отдельный протокол аутентификации.

## LDAP vs LDAPS vs StartTLS

- LDAP обычно использует TCP/389.
- LDAPS обычно использует TCP/636 и TLS с начала соединения.
- StartTLS начинает LDAP-сеанс, а затем повышает его до TLS на том же LDAP-порту (часто 389).

Порты — распространённые значения по умолчанию, а не гарантия конфигурации конкретной организации. Не отправляй simple bind с паролем по незашифрованному соединению.

## Как LDAP/AD участвует в Kubernetes SSO

Обычно Kubernetes API Server не выполняет прямой LDAP bind к AD для каждого запроса пользователя. Вместо этого используют промежуточный Identity Provider:

```text
User -> Dex / Keycloak -> LDAP or Active Directory
                    |
                    +-> OIDC ID token -> Kubernetes API Server
```

Dex или Keycloak проверяет учётные данные/сессию через LDAP/AD, получает атрибуты и группы и формирует OIDC claims. Kubernetes доверяет OIDC issuer и использует claims для username/groups. Доступ к API затем проверяется RBAC.

## Диагностика LDAP-интеграции

Проверяй по слоям:

1. DNS: разрешается ли hostname LDAP/Domain Controller.
2. Сеть: доступен ли нужный порт из Pod/сервиса IdP.
3. TLS: доверяет ли IdP сертификату сервера; совпадает ли hostname с SAN.
4. Bind: корректны ли bind DN/service account и пароль.
5. Search: правильные ли base DN, filter и scope.
6. Groups: корректно ли разрешаются прямые и вложенные группы.
7. Mapping: попадают ли ожидаемые username/group values в OIDC claims.

Если установлен ldap-utils, полезны команды:

```bash
# Проверить DNS
nslookup ldap.corp.example.com

# Проверить TCP-порт (если доступен nc)
nc -vz ldap.corp.example.com 636

# Пример безопасного LDAPS search: пароль будет запрошен интерактивно
ldapsearch -H ldaps://ldap.corp.example.com:636 \
  -D 'CN=svc-oidc,OU=Service Accounts,DC=corp,DC=example,DC=com' \
  -W \
  -b 'DC=corp,DC=example,DC=com' \
  '(sAMAccountName=arsen)' dn memberOf
```

Не помещай пароль в командную строку через `-w password`: он может попасть в shell history и список процессов. Не отключай проверку TLS ради «быстрого исправления».

## Типовые проблемы

| Симптом | Возможная причина |
|---|---|
| Connection refused / timeout | Неверный адрес/порт, firewall, маршрут, NetworkPolicy |
| Can't contact LDAP server | DNS, сеть, TLS handshake или недоступность DC |
| Invalid credentials | Неверный bind DN/пароль, заблокированная или истёкшая сервисная учётка |
| No such object | Ошибка base DN или DN записи |
| Search возвращает пользователя без групп | Неверный filter/attribute, nested groups, ограничения search account |
| TLS certificate verify failed | Нет доверенного CA, истёк сертификат, hostname mismatch |
| В UI логин успешный, Kubernetes 403 | LDAP bind мог пройти, но group claim или RBAC mapping неверен |

## Что спросить у AD/LDAP команды

- FQDN и порт, LDAPS или StartTLS.
- Base DN для users и groups.
- Какой атрибут является уникальным username.
- Как вычисляются вложенные группы.
- Какой service account используется для search и какие у него права.
- Где хранится доверенный CA bundle и кто отвечает за ротацию сертификатов.
- Какие группы должны отображаться в токене как Kubernetes groups.

См. также [общую схему Identity & Access Management](README.md) и [RBAC](../11-rbac/README.md).
