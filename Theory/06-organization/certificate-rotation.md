# Certificate rotation: control plane и приложения

В Kubernetes есть несколько независимых контуров сертификатов. Не смешивай ротацию PKI control plane, TLS Secret приложения и сертификаты, которыми управляет cert-manager или оператор базы данных.

## 1. kubeadm control-plane certificates

Для kubeadm-кластера проверь срок действия сертификатов на каждой control-plane ноде:

    sudo kubeadm certs check-expiration

Команда показывает сертификаты в локальном kubeadm PKI и client certificates в kubeconfig-файлах. Она не показывает автоматически ротируемый kubelet client certificate в /var/lib/kubelet/pki.

Важные ограничения:
- kubeadm автоматически обновляет управляемые им сертификаты во время control-plane upgrade, если renewal не отключён.
- Ручная команда kubeadm certs renew all изменяет сертификаты и требует отдельного change window, backup и плана рестарта компонентов.
- В HA-кластере ручное обновление нужно выполнить на каждой control-plane ноде с учётом порядка и доступности API.
- После обновления нужно перезапустить соответствующие control-plane static Pods: не все компоненты динамически перечитывают сертификаты.
- kubeadm не выполняет ротацию/замену CA-сертификатов автоматически. Сертификаты, подписанные внешним CA, управляются внешним процессом.

Не запускай renew в production как диагностическую команду. Сначала проверь сроки, topology, backup, SAN/endpoint и процедуру перезапуска по официальной документации целевой версии.

## 2. TLS Secret приложений

Ingress и приложения могут использовать Secret типа kubernetes.io/tls с ключами tls.crt и tls.key. Обновление Secret не означает, что само приложение уже использует новый сертификат.

- Secret, смонтированный как обычный volume, обновляется kubelet eventually-consistent способом.
- Secret, смонтированный через subPath, автоматически не обновляется.
- Значения Secret, переданные через environment variables, не обновляются в уже запущенном процессе.
- Даже если файл в контейнере обновился, приложение должно перечитать его. Это зависит от приложения и способа запуска.
- Ingress Controller обычно отслеживает Secret, но конкретное поведение нужно проверять по документации выбранной реализации.

Для безопасной проверки не выводи приватный ключ:

    kubectl get secret <tls-secret> -n <namespace> -o jsonpath='{.type}{"\n"}{.data.tls\.crt}' | base64 -d | openssl x509 -noout -subject -issuer -dates

Команда читает только сертификат, но не ключ. Не публикуй её вывод, если в нём есть внутренние домены или иные чувствительные сведения.

## 3. cert-manager и операторы

cert-manager автоматизирует выпуск и обновление сертификатов через Issuer/ClusterIssuer и Certificate. После renewal он обновляет указанный Secret. Это не гарантирует, что каждый consumer перечитал сертификат: проверь volume/subPath/env usage и поведение приложения/controller.

Для диагностики cert-manager (если CRD установлены):

    kubectl get certificate,certificaterequest,order,challenge -A
    kubectl describe certificate <certificate> -n <namespace>
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Операторы stateful-приложений могут координировать rolling restart, чтобы обновить сертификаты по одному экземпляру. Не запускай ручной rollout restart вместо предусмотренного оператором процесса: это может нарушить quorum или availability.

## 4. RCA checklist

1. Какой именно сертификат истекает: API Server, etcd, kubelet, Ingress или приложение?
2. Кто владелец lifecycle: kubeadm, внешний CA, cert-manager, оператор или команда приложения?
3. Где находится private key и кто имеет к нему доступ?
4. Какие consumers читают Secret: volume, subPath, environment variable, Ingress Controller?
5. Как consumer подхватывает обновление и как проверить фактический serial/expiry?
6. Нужен ли restart/rolling restart и как соблюсти PDB/quorum?
7. Есть ли backup и проверенный rollback/renewal plan?

## Связанные заметки

- [Certificates in Kubernetes](certificates-in-k8s.md)
- [cert-manager](cert-manager-explained.md)
- [Secrets](../04-config/configmap-and-secret.md)
- [kubeadm bootstrap](../08-cluster-admin/kubeadm-bootstrap.md)

## Официальная документация

- [Certificate Management with kubeadm](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [cert-manager documentation](https://cert-manager.io/docs/)
