# Lab: ImagePullBackOff

**Симптом:** Pod не стартует; Events содержат ErrImagePull/ImagePullBackOff.

## Диагностика

    kubectl describe pod <pod> -n <namespace>
    kubectl get pod <pod> -n <namespace> -o jsonpath='{.spec.containers[*].image}{"\n"}'
    kubectl get serviceaccount <service-account> -n <namespace> -o yaml
    kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp

Проверь image name/tag/digest, registry reachability, DNS/network, rate limits, imagePullSecrets и права ServiceAccount. Не выводи содержимое registry credentials.

## Root cause

Отличи manifest typo/tag missing от unauthorized, TLS/CA error, DNS/timeout и registry rate limit.

## Безопасное исправление

Исправь подтверждённый image reference или настрой scoped pull secret через secret-management процесс. Не используй публичный/анонимный доступ как обход приватного registry.

## Проверка

Образ скачан, контейнер стартовал, Pod Ready, image digest соответствует ожидаемому release.
