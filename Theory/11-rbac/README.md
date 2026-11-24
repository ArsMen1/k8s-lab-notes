# RBAC и ServiceAccounts

RBAC отвечает на вопрос: может ли аутентифицированная identity выполнить конкретное действие над API resource в заданном scope? Это authorization, не authentication и не network firewall.

## Четыре объекта

- Role — набор разрешений в одном namespace.
- RoleBinding — связывает Role или ClusterRole с User, Group или ServiceAccount в одном namespace.
- ClusterRole — набор разрешений на уровне кластера; может описывать cluster-scoped и namespaced resources.
- ClusterRoleBinding — связывает ClusterRole с субъектами на уровне всего кластера.

Правила задают apiGroups, resources, verbs и иногда resourceNames. RBAC additive: правила разрешают действия, явных deny-правил нет.

## ServiceAccount и least privilege

Pod получает identity ServiceAccount из своего namespace. Если serviceAccountName не задан, используется default ServiceAccount, но для приложений лучше создавать отдельную identity.

1. Создай отдельный ServiceAccount для workload.
2. Выдай только нужные verbs/resources.
3. Используй Role/RoleBinding, если доступ нужен в одном namespace.
4. ClusterRoleBinding применяй только при реальной необходимости cluster-wide scope.
5. Не выдавай cluster-admin приложению «чтобы заработало».

Kubernetes обычно использует short-lived projected ServiceAccount tokens. Не создавай вручную долгоживущие token Secrets без необходимости.

Для logs и exec нужны subresources pods/log и pods/exec. Для deployments API group — apps, для ConfigMaps — core API group с пустым именем.

## Пользовательская identity: authentication отдельно от RBAC

Внешний пользователь обычно аутентифицируется не через ServiceAccount. Корпоративная учётная запись может находиться в LDAP/Active Directory, а Dex или Keycloak выступать OIDC provider. Kubernetes API Server проверяет OIDC ID token, получает username/groups, после чего RBAC применяет RoleBinding/ClusterRoleBinding.

Подробный поток и диагностика: [Identity & Access Management](../17-identity-access/README.md). Важно: AD-группа не получает Kubernetes permissions автоматически — её имя должно корректно попасть в token claims и совпасть с subject в binding.

## Проверка и RCA Forbidden

    kubectl auth whoami
    kubectl auth can-i get pods -n <namespace>
    kubectl auth can-i list secrets -n <namespace>
    kubectl auth can-i create deployments.apps -n <namespace>
    kubectl get role,rolebinding -n <namespace>
    kubectl get clusterrole,clusterrolebinding

Для ServiceAccount можно проверить impersonation, если у вызывающего пользователя есть соответствующие права:

    kubectl auth can-i get configmaps -n <namespace> --as=system:serviceaccount:<namespace>:<service-account>

При 403 зафиксируй identity, verb, resource, API group и namespace. Проверь ServiceAccount workload, subject в binding и scope. 403 может вернуть также admission webhook или внешний proxy, а не RBAC authorizer.

Практика: [RBAC Forbidden — приложение не может читать Kubernetes API](../../labs/troubleshooting/rbac-forbidden.md).\n\nСвязанные материалы: [RBAC manifests](../../Manifests/rbac/README.md), [P0 labs](../../labs/fundamentals-p0/README.md). Официально: [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/).
