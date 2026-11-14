# RBAC manifests

Least-privilege пример: ServiceAccount может читать ConfigMaps только в lab-p0, но не Secrets.

    kubectl apply -f Manifests/rbac/namespace.yaml
    kubectl apply -f Manifests/rbac/serviceaccount.yaml
    kubectl apply -f Manifests/rbac/role.yaml
    kubectl apply -f Manifests/rbac/rolebinding.yaml
    kubectl auth can-i get configmaps -n lab-p0 --as=system:serviceaccount:lab-p0:config-reader
    kubectl auth can-i get secrets -n lab-p0 --as=system:serviceaccount:lab-p0:config-reader

Ожидается yes для ConfigMaps и no для Secrets. Impersonation требует прав у текущего пользователя; эти манифесты их не выдают.
