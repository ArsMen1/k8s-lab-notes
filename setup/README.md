# Local Kubernetes environment

This folder contains alternative Infrastructure as Code examples for a local [kind](https://kind.sigs.k8s.io/) cluster.

> Creates local Docker containers only. It does not deploy the repo's application manifests or target a remote cluster.

## Requirements
- Docker running
- kind installed
- Choose Terraform or Pulumi + Node.js

Cluster: `k8s-lab` with one control-plane and one worker. Host port `8080` maps to node port `30080`. A dedicated kubeconfig is saved in `setup/.kube/kubeconfig`, not your default config.

## Options
- [Terraform](terraform/README.md)
- [Pulumi TypeScript](pulumi/README.md)

## Manual kind command (from setup/)
```bash
kind create cluster --name k8s-lab --config kind-config.yaml --kubeconfig .kube/kubeconfig
```

## Verify (from setup/)
Bash:
```bash
export KUBECONFIG="$(pwd)/.kube/kubeconfig"
kubectl config current-context
kubectl get nodes -o wide
kubectl get pods -A
```
PowerShell:
```powershell
$env:KUBECONFIG = "$(Get-Location)/.kube/kubeconfig"
kubectl config current-context
kubectl get nodes -o wide
kubectl get pods -A
```

## Cleanup
Use the destroy command in your chosen IaC guide, or manually `kind delete cluster --name k8s-lab`.