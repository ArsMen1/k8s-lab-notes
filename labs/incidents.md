# Первая неделя в «Сдаче»

Финтех «Сдача» проводит оплату для ларьков. Шаурму клиент получает сразу, деньги — когда кластер согласен.

Ты вышел в платформу в понедельник. Кирилл, единственный человек, который трогал этот кластер руками, написал в чат: «я на созвоне, там всё зелёное, если что — смотри события». Алина из продукта измеряет инциденты в порциях шаурмы. Бот дежурств зовут Пятница. Он не шутит.

Правила недели:

1. Сначала кластер, потом догадка одним предложением, и только потом разбор.
2. Разборы лежат в [`debrief/`](debrief/README.md). Пока нет своей версии «что сломано и почему», туда не заходи. В этом файле ответов нет.
3. Манифест инцидента — улика, не шпаргалка. Открывай его после `describe` / `logs` / `endpoints`, когда уже есть подозреваемый.
4. Один инцидент — один файл в `Manifests/incidents/`. Номер совпадает с днём.

Если термины ниже плывут, не геройствуй: вернись в заметку по ссылке и потом снова в кластер.

Общий сброс, когда надоело жить в последствиях:

```bash
kubectl delete ns incidents payments platform lab --ignore-not-found
kubectl delete svc checkout -n default --ignore-not-found
```

---

## День 1. Шаурма не оплачивается

Пятница, 10:14

> NodePort `shop-front` молчит. Алина говорит, что касса открывается, а оплата нет. Кирилл поставил реакцию «глаза» и ушёл дописывать дизайн-док.

Снаружи это `Connection refused` на порту **30081**. Внутри кластера сервис тоже никуда не ведёт.

Перед кластером, если слова «селектор» и «Endpoints» ещё не свои: [[labels-and-selectors]] · [[why-service]] · [[where-are-endpoints-stored]] · [[network-traffic-path]] · [[kubectl-debug]]

```bash
kubectl apply -f Manifests/incidents/01.yaml
kubectl -n incidents get pods,svc
```

Дальше ты сам. Починка — это изменённый манифест и повторный `apply`, не удаление namespace «чтобы отстало».

Своя версия причины уже есть — [разбор дня 1](debrief/01.md).

---

## День 2. Под, который сам себе пишет некролог

Кирилл, 11:02

> Чеки не выгружаются. Я вчера «на минутку» добавил проверку базы в старт контейнера. Выглядело разумно.

`kubectl get pods -n incidents` показывает `CrashLoopBackOff` у `receipts`. Пятница считает рестарты и, кажется, наслаждается.

Если ещё не отделяешь «процесс умер» от «образ не скачался»: [[where-is-nginx-from]] · [[kubectl-debug]] · [[cheatsheet]]

```bash
kubectl apply -f Manifests/incidents/02.yaml
kubectl -n incidents get pods
```

Не останавливайся на первой страшной строке.

[Разбор дня 2](debrief/02.md)

---

## День 3. Под, которому мало вселенной

Алина, 14:40

> Леджер не стартует. Разработчик сказал, что «просто попросил ресурсов с запасом, как в той статье про прод».

Статус `Pending`. Ноды в учебном кластере не резиновые.

[[what-is-kubernetes]] · [[scheduling-taints-affinity]] · [[kubectl-debug]]

Когда дойдёшь до манифеста, сравни числа с рабочим `Manifests/payments-api/`. Порядок величин там спокойный.

```bash
kubectl apply -f Manifests/incidents/03.yaml
kubectl -n incidents describe pod -l app.kubernetes.io/name=ledger
```

[Разбор дня 3](debrief/03.md)

---

## День 4. Ночной пайплайн верит в себя

Это единственный день с прелюдией. Сначала в namespace `payments` должна жить нормальная версия, иначе откатывать будет некуда.

```bash
kubectl apply -f Manifests/payments-api/
kubectl -n payments rollout status deploy/payments-api
```

Потом Кирилл, 02:17, уже из кровати:

> CI накатил хотфикс. Ревизия новая. Клиенты видят, что оплата не поднимается. Я не буду делать `git revert` глазами, у Deployment есть память. Покажи, что ты ею пользуешься.

[[rolling-update]] · [[where-is-nginx-from]] · [[how-kubectl-works]]

```bash
kubectl apply -f Manifests/incidents/04.yaml
kubectl -n payments rollout status deploy/payments-api
```

Почини так, чтобы следующая мысль была про историю ревизий, а не про «давайте ещё раз руками впишем тег и надеемся».

[Разбор дня 4](debrief/04.md)

---

## День 5. Зелёный под, мёртвый сервис

Пятница, 12:05

> `menu` в статусе Running. Сервис создан. Запросы внутрь не доходят. Алина уже объясняет ларьку, что «бэкенд почти здоров».

Поды не падают. Именно это и подозрительно.

[[health-probes]] · [[why-service]] · [[where-are-endpoints-stored]]

```bash
kubectl apply -f Manifests/incidents/05.yaml
kubectl -n incidents get pods
kubectl -n incidents get endpoints menu
```

Проверка из кластера, когда захочешь увидеть отказ сам:

```bash
kubectl -n incidents run curl-day5 --rm -it --restart=Never --image=curlimages/curl -- curl -sv --max-time 5 http://menu
```

[Разбор дня 5](debrief/05.md)

---

## День 6. Секрет, который почти тот

Разработчик выплат пишет Кириллу, Кирилл пересылает тебе без комментария:

> Secret я создал. Ключ там есть. Под не стартует. Это точно кластер.

Под не в `CrashLoopBackOff` и не в `Pending`. Статус другой, и в Events он назван прямо.

[[configmap-and-secret]] · [[twelve-factor-app]] · [[kubectl-debug]]

```bash
kubectl apply -f Manifests/incidents/06.yaml
kubectl -n incidents get pods
kubectl -n incidents describe pod -l app.kubernetes.io/name=payouts
```

`kubectl describe secret` показывает имена ключей, не значения. Этого достаточно.

[Разбор дня 6](debrief/06.md)

---

## День 7. Сервис есть. Подов нет. Поды есть. Не здесь

Кирилл, наконец на месте:

> Кассу вынесли в namespace `incidents`, «чтобы не мусорить в default». Сервис оставили, где был, «потому что фронт уже ходит в `checkout`». Классика переезда в пятницу вечером. Сегодня воскресенье, но ощущение то же.

Из `default` имя `checkout` резолвится. Подключиться не к кому.

[[namespaces]] · [[labels-and-selectors]] · [[service-types]]

```bash
kubectl apply -f Manifests/incidents/07.yaml
kubectl get svc checkout -n default
kubectl -n incidents get pods -l app.kubernetes.io/name=checkout
kubectl get endpoints checkout -n default
```

Короткое DNS-имя ищется только в своём namespace. Это пригодится, когда будешь решать, куда переносить объект.

[Разбор дня 7](debrief/07.md)

---

## Если дошёл до сюда

Ты уже не «прочитал YAML», ты расследовал. Дальше в теории — то, чего в этих семи днях ещё не было: [[ingress-and-loadbalancer]], [[scheduling-taints-affinity]] целиком, [[spring-config-server]], и вопросы без заметок в [[roadmap-questions]].
