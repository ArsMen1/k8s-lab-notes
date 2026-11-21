# Terraform: local kind cluster

Terraform manages a local kind cluster by invoking the installed `kind` CLI. Docker must be running. No Kubernetes app manifests are applied.

## Requirements
- Docker running
- kind installed
- Terraform installed

## Run from this directory
```bash
terraform init
terraform plan
terraform apply
```
Review the plan before confirming. Verify:
```bash
kubectl --kubeconfig ../../setup/.kube/kubeconfig get nodes -o wide
kubectl --kubeconfig ../../setup/.kube/kubeconfig get pods -A
```
## Destroy
```bash
terraform destroy
```
## Safety notes
- State is local and Git-ignored; never commit it.
- Terraform does not deploy labs or run `kubectl apply`.
- Paths and cluster name are configurable in `main.tf`.
- Destroy removes the cluster name recorded in state.