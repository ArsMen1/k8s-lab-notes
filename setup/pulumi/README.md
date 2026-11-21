# Pulumi: local kind cluster (TypeScript)

Pulumi creates a local kind cluster by calling the installed `kind` CLI via the Pulumi Command provider. Docker must be running. It does not deploy workloads or apply Kubernetes manifests.

## Requirements
- Docker running
- kind installed
- Node.js/npm
- Pulumi CLI

## Run from this directory
```bash
npm install
pulumi stack init dev
pulumi config set clusterName k8s-lab
pulumi up
```
Review the preview before confirming. Verify:
```
kubectl --kubeconfig ../../setup/.kube/kubeconfig get nodes -o wide
kubectl --kubeconfig ../../setup/.kube/kubeconfig get pods -A
```
## Destroy
```bash
pulumi destroy
```
## Notes
- Uses a dedicated kubeconfig file, not the default one.
- No lab workloads are deployed automatically.
- Keep Pulumi state local and do not commit it.