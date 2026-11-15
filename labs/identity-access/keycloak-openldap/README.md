# Практика: Keycloak + OpenLDAP

Это первый этап IAM-лаборатории. Он поднимает локальный LDAP-каталог и Keycloak, подключает каталог через User Federation и позволяет проверить импорт пользователя и группы.

На этом этапе Kubernetes ещё не подключаем. Сначала подтверждаем LDAP bind/search и федерацию. Следующий этап добавит HTTPS issuer, OIDC client, ID token claims и Kubernetes API Server integration.

## Архитектура

~~~text
Браузер на компьютере
       |
       | http://localhost:8080 (только локальный учебный стенд)
       v
    Keycloak 26.8.2
       |
       | LDAP: ldap://openldap:389
       v
    OpenLDAP 1.5.0
       |
       +-- uid=arsen,ou=people,dc=example,dc=org
       |
       +-- cn=k8s-readers,ou=groups,dc=example,dc=org
             member = uid=arsen,...
~~~

Контейнеры общаются по внутренней Docker network. LDAP опубликован только на loopback 127.0.0.1:1389, Keycloak UI — только на 127.0.0.1:8080.

## Prerequisites

- Docker Engine или Docker Desktop с Compose v2.
- Git.
- Свободные локальные TCP-порты 8080 и 1389.
- Доступ к registry для загрузки образов OpenLDAP и Keycloak.
- Терминал; для проверок пригодятся curl и jq.

Проверка:

~~~bash
docker --version
docker compose version
git --version
~~~

**Состояние образов на 2026-11-15:** Keycloak закреплён на 26.8.2 — актуальном выпуске на дату аудита. OpenLDAP пока использует `osixia/openldap:1.5.0`: upstream объявил ветку v1 deprecated и больше не выпускает для неё обновления/исправления. Поэтому этот образ допустим только для одноразового локального упражнения с loopback-публикацией; не используй его в production и не открывай LDAP в LAN/Internet. Перед расширением лаборатории замени его на поддерживаемый OpenLDAP 2.6 image после отдельной проверки совместимости entrypoint, bootstrap LDIF и volume layout.

**Сохранение состояния Keycloak:** Compose не подключает volume к Keycloak. В `start-dev` используется development database `dev-file`, поэтому состояние realm/federation хранится в writable layer контейнера. `docker compose stop` / `start` сохраняют его, пока контейнер не пересоздан. `docker compose down` удаляет контейнер и сбрасывает Keycloak state, но LDAP named volumes остаются. Перенос `dev-file` между версиями Keycloak не поддерживается; перед сменой версии экспортируй нужный realm локально или будь готов создать его заново. Не коммить realm export, если он содержит секреты или персональные данные. См. [Keycloak upgrade guide](https://www.keycloak.org/docs/latest/upgrading/).

**Безопасность:** это disposable lab, не production. OpenLDAP внутри стенда работает без TLS, потому что трафик остаётся в изолированной Docker network. Не подключай реальные учётные записи или пароли. Keycloak использует dev mode и HTTP, привязанный к localhost; не открывай эти порты в LAN/Internet. Для Kubernetes OIDC такой endpoint не подходит: API Server требует HTTPS issuer и доверенную CA. HTTPS будет отдельным этапом. Пароли создаются локально в .env, который игнорируется Git.

## Этап 1.1 — подготовить локальные переменные

Из этого каталога:

~~~bash
cp .env.example .env
~~~

Открой .env и замени все значения CHANGE_ME_LOCAL_LAB_ONLY на разные случайные пароли. Используй только временные значения для лаборатории, не пароль от рабочих систем.

Проверь, что файл не отслеживается Git:

~~~bash
git check-ignore .env
~~~

Ожидаемый результат — .env.

## Этап 1.2 — запустить LDAP и Keycloak

~~~bash
docker compose config
docker compose pull
docker compose up -d
docker compose ps
~~~

Ожидаемо:
- iam-openldap запущен;
- iam-keycloak запущен;
- LDAP слушает внутри сети на openldap:389, с хоста доступен только через localhost:1389;
- Keycloak UI доступен на http://localhost:8080.

Первый запуск Keycloak может занять минуту или две:

~~~bash
docker compose logs --tail=100 keycloak
docker compose logs --tail=100 openldap
~~~

Открой http://localhost:8080, войди под bootstrap admin из .env. Это локальный admin realm account, не LDAP-пользователь.

## Этап 1.3 — проверить LDAP-каталог

Проверить, что пользователь создан:

~~~bash
docker compose exec openldap sh -c 'ldapsearch -x -H ldap://localhost:389 -D "cn=admin,dc=example,dc=org" -w "$LDAP_ADMIN_PASSWORD" -b "dc=example,dc=org" "(uid=arsen)" dn uid cn mail'
~~~

Проверить группу:

~~~bash
docker compose exec openldap sh -c 'ldapsearch -x -H ldap://localhost:389 -D "cn=admin,dc=example,dc=org" -w "$LDAP_ADMIN_PASSWORD" -b "ou=groups,dc=example,dc=org" "(cn=k8s-readers)" dn cn member'
~~~

Ожидаемый результат:
- пользователь uid=arsen;
- DN пользователя uid=arsen,ou=people,dc=example,dc=org;
- группа cn=k8s-readers;
- member группы указывает на DN пользователя.

У seed-пользователя пока нет пароля. Задай его интерактивно:

~~~bash
docker compose exec openldap sh -c 'ldappasswd -x -H ldap://localhost:389 -D "cn=admin,dc=example,dc=org" -w "$LDAP_ADMIN_PASSWORD" -S "uid=arsen,ou=people,dc=example,dc=org"'
~~~

Команда попросит ввести новый пароль дважды.

## Этап 1.4 — создать realm в Keycloak

1. Открой http://localhost:8080 и войди в Admin Console.
2. Создай realm с именем k8s-lab.
3. Убедись, что выбран именно realm k8s-lab, а не master.

Realm изолирует настройки пользователей, клиентов и identity federation.

## Этап 1.5 — подключить OpenLDAP через User Federation

В realm k8s-lab:

1. Открой **User federation → Add LDAP providers**.
2. Для учебного OpenLDAP укажи vendor Other.
3. Заполни параметры:

| Поле Keycloak | Значение |
|---|---|
| Connection URL | ldap://openldap:389 |
| Bind type | simple |
| Bind DN | cn=admin,dc=example,dc=org |
| Bind credential | LDAP_ADMIN_PASSWORD из локального .env |
| Users DN | ou=people,dc=example,dc=org |
| Username LDAP attribute | uid |
| RDN LDAP attribute | uid |
| UUID LDAP attribute | entryUUID |
| User object classes | inetOrgPerson, organizationalPerson |
| Search scope | One Level |
| Edit mode | READ_ONLY |
| Import users | ON |
| Sync registrations | OFF |

4. Нажми **Test connection**, затем **Test authentication**.
5. Сохрани provider.
6. Запусти **Synchronize all users**.

> Для простоты в disposable стенде используется LDAP admin DN. В production создай отдельную read-only service account с доступом только к нужным веткам каталога. Не используй admin bind.

В Connection URL используй имя Docker-сервиса openldap, а не localhost. Внутри контейнера localhost — сам Keycloak.

## Этап 1.6 — импортировать LDAP-группу

В конфигурации LDAP provider открой **Mappers → Add mapper** и выбери **group-ldap-mapper**. Используй значения, соответствующие полям своей версии Keycloak:

| Параметр | Значение |
|---|---|
| Name | k8s-groups |
| LDAP Groups DN | ou=groups,dc=example,dc=org |
| Group Name LDAP Attribute | cn |
| Group Object Classes | groupOfNames |
| Membership LDAP Attribute | member |
| Membership Attribute Type | DN |
| User Groups Retrieve Strategy | LOAD_GROUPS_BY_MEMBER_ATTRIBUTE |
| Preserve Group Inheritance | OFF |
| Ignore Missing Groups | OFF |

Сохрани mapper и выполни **Sync LDAP groups to Keycloak** / **Synchronize all users** в зависимости от доступных действий. Открой Users → arsen → Groups и проверь, что пользователь входит в /k8s-readers.

Если группа не появилась, проверь LDIF и member DN через ldapsearch, затем LDAP Groups DN, object class, membership attribute и retrieval strategy. Названия отдельных полей могут отличаться между версиями Keycloak.

## Этап 1.7 — контрольная проверка

- [ ] Оба контейнера в состоянии running.
- [ ] LDAP search находит arsen.
- [ ] LDAP search находит k8s-readers с правильным member.
- [ ] Keycloak Test connection и Test authentication успешны.
- [ ] Пользователь импортирован в realm k8s-lab.
- [ ] В Keycloak пользователь arsen состоит в группе /k8s-readers.

Проверить OIDC discovery endpoint можно уже сейчас:

~~~bash
curl -fsS http://localhost:8080/realms/k8s-lab/.well-known/openid-configuration
~~~

Ожидается JSON с issuer, authorization_endpoint, token_endpoint и jwks_uri. Это HTTP-only endpoint для локальной диагностики, пока не для Kubernetes. На следующем этапе мы переведём issuer на HTTPS и настроим OIDC client с claim groups.

## Troubleshooting

| Симптом | Проверка |
|---|---|
| docker compose config сообщает missing variable | .env отсутствует или содержит пустые значения |
| LDAP container перезапускается | docker compose logs openldap; проверь bootstrap LDIF и переменные |
| ldapsearch не находит пользователя | LDIF применяется при первичной инициализации пустого volume; старый volume мог сохраниться |
| Keycloak не соединяется с LDAP | используй openldap:389, проверь docker compose ps и логи |
| Invalid credentials при LDAP bind | проверь bind DN и LDAP_ADMIN_PASSWORD |
| Test authentication failed | пользователю нужно задать LDAP password через ldappasswd |
| Пользователь есть, группа не отображается | проверь group mapper, member DN и синхронизацию |

Чтобы временно остановить disposable стенд, не удаляя контейнер и его локальную базу Keycloak:

~~~bash
docker compose stop
~~~

Возобновить работу можно командой `docker compose start`. Если требуется пересоздать контейнеры, `docker compose down` удалит Keycloak dev-file state, но сохранит LDAP named volumes. Для полного сброса LDAP-каталога также используй `docker compose down -v` — только после проверки, что это volumes данного Compose project.

## Active Directory вместо OpenLDAP

OpenLDAP здесь нужен как лёгкий каталог для отработки LDAP bind, search, DN и group membership. Он не эмулирует Active Directory целиком.

В реальной организации Keycloak подключают к AD через **User federation → LDAP providers**:
- LDAP URL указывает на контроллер домена, обычно ldaps://dc01.corp.example.com:636 или StartTLS согласно корпоративной политике.
- Base DN соответствует домену, например DC=corp,DC=example,DC=com.
- Username attribute часто sAMAccountName или userPrincipalName.
- UUID attribute для AD обычно objectGUID; формат и настройка зависят от provider.
- User object classes и фильтры выбираются под AD schema.
- Для групп обычно используют CN и атрибут member; вложенные группы требуют отдельной проверки.
- Bind выполняется отдельной service account с минимальными read permissions.
- Keycloak должен доверять сертификату LDAPS endpoint.

AD дополнительно использует Kerberos, DNS, Group Policy и специфические атрибуты и семантику групп. Подключение по LDAP не переносит Kerberos или Group Policy в Keycloak.

## Остановка стенда

~~~bash
docker compose stop
~~~

Чтобы продолжить с тем же realm и LDAP-каталогом, выполни `docker compose start`. `docker compose down` удаляет контейнер Keycloak и его dev-file state; LDAP named volumes при этом сохраняются. Полный сброс LDAP выполняй только осознанно через `docker compose down -v`, предварительно проверив имя Compose project.

## Источники

- [Keycloak Server Administration Guide — LDAP and Active Directory](https://www.keycloak.org/docs/latest/server_admin/#_ldap)
- [Keycloak container guide](https://www.keycloak.org/server/containers)
- [Kubernetes authentication](https://kubernetes.io/docs/reference/access-authn-authz/authentication/)
- [kind configuration](https://kind.sigs.k8s.io/docs/user/configuration/)
