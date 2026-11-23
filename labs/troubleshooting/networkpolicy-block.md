# NetworkPolicy incident: policy блокирует DNS или application traffic

## Симптом

После применения/изменения NetworkPolicy Pod не может резолвить DNS, обращаться к backend, получать health checks или внешним dependencies.

## 1. Impact и изменения

- Какие Pods/namespace затронуты?
- Входящий, исходящий или оба направления traffic?
- Когда policy была добавлена/изменена?
- DNS failure, timeout, refused или application-level error?
- Какие labels имеют affected Pod и namespace?

## 2. Read-only inventory

```bash
kubectl get networkpolicy -A
kubectl describe networkpolicy <policy> -n <namespace>
kubectl get pods -n <namespace> --show-labels
kubectl get namespaces --show-labels
kubectl get pods -n kube-system --show-labels
```

Установи, какие policies выбирают Pod, и какие направления изолированы. Если Pod изолирован для ingress/egress, трафик разрешён union всех подходящих policies. Для соединения могут влиять source egress и destination ingress policies.

## 3. DNS — частая зависимость

Проверь, разрешён ли UDP и TCP port 53 к фактическим CoreDNS Pods/Service, и соответствуют ли namespace/pod selectors реальным labels. Не копируй selectors из чужого кластера. NetworkPolicy enforcement зависит от CNI. DNS traffic к Service IP и поведение dataplane могут различаться; проверяй на своем CNI.

## 4. Разбери конкретный flow

Сформулируй направление:

- source Pod → DNS resolver (UDP/TCP 53)
- source Pod → destination Pod / Service port
- destination Pod ← source Pod

Укажи namespace, labels, protocol, port и обе стороны policy. Учитывай, что NetworkPolicy L3/L4; HTTP paths и application auth она не фильтрует.

## 5. Safe mitigation — план, не применять

Не удаляй policy и не делай `allow-all` egress/ingress ради быстрой проверки в shared cluster. В disposable lab можно сравнить результат до/после узкой разрешающей policy, если это отдельно разрешено. В production предложи минимальный rule, привязанный к подтверждённому source/destination, protocol/port, DNS dependency и change process.

## 6. Verification

После согласованного изменения:
- DNS resolution снова работает;
- нужный TCP flow проходит;
- запрещённые flows остаются запрещены;
- application health и latency восстановлены;
- соседние workloads не получили лишнего доступа.

Команды в этой лабораторной read-only. Не применяй или удаляй NetworkPolicy без разрешения.
