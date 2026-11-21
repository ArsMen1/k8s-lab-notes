terraform {
  required_version = ">= 1.5.0"
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}
variable "cluster_name" {
  description = "Name of the local kind cluster"
  type = string
  default = "k8s-lab"
}
variable "kind_config_path" {
  description = "kind config path relative to this directory"
  type = string
  default = "../../kind-config.yaml"
}
variable "kubeconfig_path" {
  description = "Dedicated kubeconfig path"
  type = string
  default = "../../setup/.kube/kubeconfig"
}
resource "null_resource" "kind_cluster" {
  triggers = {
    cluster_name = var.cluster_name
    config_hash = filesha256(var.kind_config_path)
  }
  provisioner "local-exec" {
    command = "mkdir -p \"$(dirname '${var.kubeconfig_path}')\" && kind create cluster --name '${var.cluster_name}' --config '${var.kind_config_path}' --kubeconfig '${var.kubeconfig_path}'"
  }
  provisioner "local-exec" {
    when = destroy
    command = "kind delete cluster --name '${self.triggers.cluster_name}'"
  }
}
output "cluster_name" { value = var.cluster_name }
output "kubeconfig_path" { value = var.kubeconfig_path }
