# cert-manager: Автоматизация сертификатов в Kubernetes

В файле [[certificates-in-k8s]] мы разобрали, *как* сертификат физически попадает в под (через Secret и Volume). Но кто его туда кладет? В современном Kubernetes это делает оператор **cert-manager**.

## 🎯 Что это такое?

`cert-manager` — это оператор (controller), который автоматизирует выпуск, обновление и хранение TLS-сертификатов. Вы описываете *желаемый* сертификат в YAML, а `cert-manager` идет к Удостоверяющему Центру (CA), получает сертификат и кладет его в Kubernetes Secret.

Простыми словами: **вы заказываете сертификат через `kubectl apply`, а `cert-manager` делает всю грязную работу.**

## 🧩 Ключевые объекты (CRD)

cert-manager добавляет в Kubernetes свои собственные типы ресурсов. Чтобы понять его работу, нужно знать три из них:

| Объект | Что делает | Аналогия |
| :--- | :--- | :--- |
| **`Issuer` / `ClusterIssuer`** | Описывает **кто** может выдать сертификат (Let's Encrypt, внутренний CA, Vault). | **Паспортный стол** (источник доверия). |
| **`Certificate`** | Описывает **что** вы хотите получить: домены, срок жизни, куда положить. | **Заявление на выдачу паспорта**. |
| **`Secret`** | **Результат**. Сюда `cert-manager` кладет `tls.crt` и `tls.key`. | **Готовый паспорт** в кармане. |

**Разница между `Issuer` и `ClusterIssuer`:**
*   `Issuer` работает только в пределах одного namespace.
*   `ClusterIssuer` работает во всем кластере (удобно для Let's Encrypt).

## 🔄 Как это работает под капотом (пошагово)

Представь, что ты создал `Certificate` для домена `myapp.example.com`.

1.  **Создание ресурса**: Ты применяешь `Certificate`. В нем написано: "Хочу сертификат для `myapp.example.com`, используй `ClusterIssuer` с именем `letsencrypt-prod`, положи результат в Secret `myapp-tls`".
2.  **Обнаружение**: `cert-manager` (его контроллер) видит новый объект `Certificate`.
3.  **Запрос**: `cert-manager` создает объект `CertificateRequest` и идет к указанному `Issuer` (например, к Let's Encrypt).
4.  **Проверка владения (Challenge)**: Let's Encrypt говорит: "Докажи, что домен твой". `cert-manager` автоматически решает эту задачу (см. следующий раздел).
5.  **Получение**: Let's Encrypt выдает сертификат.
6.  **Сохранение**: `cert-manager` берет сертификат и приватный ключ и записывает их в Kubernetes Secret с именем `myapp-tls` (тип `kubernetes.io/tls`).
7.  **Использование**: Твой Ingress Controller (например, Nginx) видит этот Secret и начинает использовать его для терминации HTTPS-трафика.

## 🛡️ Типы проверки владения (ACME Challenges)

Если ты используешь Let's Encrypt (протокол ACME), `cert-manager` должен доказать, что ты владеешь доменом. Есть два основных способа:

### 1. HTTP-01 (Простой)
`cert-manager` создает временный Ingress или Pod, который отдает специальный токен по адресу `http://<твой-домен>/.well-known/acme-challenge/<токен>`.
*   **Плюс**: Легко настроить.
*   **Минус**: Не работает для Wildcard-сертификатов (`*.example.com`). Нужен доступ из интернета на порт 80.

### 2. DNS-01 (Для Wildcard)
`cert-manager` идет в API твоего DNS-провайдера (Cloudflare, Route53, Yandex DNS) и создает временную TXT-запись.
*   **Плюс**: Работает для Wildcard. Не требует публичного IP.
*   **Минус**: Нужно дать `cert-manager` доступ к DNS (токен/ключи).

## ⏳ Автоматическое обновление (Renewal)

Это главная фича. Сертификаты Let's Encrypt живут **90 дней**. `cert-manager` следит за ними.

*   По умолчанию он обновляет сертификат, когда прошло **2/3 от срока действия** (примерно за 30 дней до истечения).
*   **Что происходит**: `cert-manager` получает новый сертификат и **обновляет тот же самый Secret** (не создает новый).
*   **Важно**: Приложение/Ingress должен уметь «подхватить» изменения в Secret. Nginx Ingress Controller делает это автоматически. А если у тебя приложение само читает файлы (например, Java), ему может понадобиться `kubectl rollout restart`, чтобы перечитать файлы с диска.

## 💡 Пример манифеста (Let's Encrypt)

Вот как выглядит связка «ClusterIssuer + Certificate»:

```yaml
# 1. Указываем, куда ходить за сертификатами
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          class: nginx
---
# 2. Заказываем сертификат для нашего домена
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: myapp-tls
  namespace: default
spec:
  secretName: myapp-tls-secret # Сюда будет положен результат
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - myapp.example.com