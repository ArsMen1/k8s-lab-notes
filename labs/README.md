# С чего начать лабораторию

Лаборатория — это не вторая теория. Сначала ты честно понимаешь, на каком ты этаже, потом идёшь в инциденты. Теория нужна ровно в тот момент, когда слово в симптоме ещё пустое.

## Порядок

1. [Проверка уровня](00-level-check.md) — семь вопросов, без ответов в файле. Сомневаешься — открываешь заметку, не поисковик.
2. [Первая неделя в «Сдаче»](incidents.md) — семь поломок по возрастанию. Ответов в этом файле нет.
3. Разбор дня лежит отдельно в [debrief](debrief/README.md). Туда заходят после своей формулировки причины.
4. Сломанные объекты — Manifests/incidents/01.yaml … 07.yaml. Рабочие сервисы — в остальных каталогах Manifests/ и к инцидентам не относятся.

## Фундаментальные треки

- [P0 Fundamentals](fundamentals-p0/README.md) — Storage, StatefulSet, RBAC, QoS, DNS и NetworkPolicy.
- [P1 labs](fundamentals-p1/README.md) — Ingress/TLS, HPA и Observability.
- [Troubleshooting labs](troubleshooting/README.md) — Node NotReady, DiskPressure, FailedMount и ImagePullBackOff.
- [Identity & Access Management](identity-access/README.md) — LDAP, OIDC, Keycloak, Active Directory и диагностика 401/403. [Практический стенд Keycloak + OpenLDAP](identity-access/keycloak-openldap/README.md).

## Следующий уровень

Практикум Production Support дополняет семь учебных инцидентов сценариями, близкими к повседневной диагностике. Он не содержит готовых ресурсов для применения в кластер: сначала используй read-only диагностику и согласовывай изменения.

## Чего здесь нет

В тексте дня нет блока «правильный ответ» под задачей. Если открыть разбор раньше, чем появилась своя версия, лаборатория превращается в чтение чужого постмортема. Это быстро и почти бесполезно.

- [Gateway API troubleshooting](troubleshooting/gateway-api-404-503.md) — GatewayClass/controller, listener attachment, backendRefs и диагностика HTTP 404/503.
