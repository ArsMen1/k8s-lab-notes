import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";

const config = new pulumi.Config();
const clusterName = config.get("clusterName") ?? "k8s-lab";
const kindConfigPath = "../kind-config.yaml";
const kubeconfigPath = "../../setup/.kube/kubeconfig";

// Creates a local kind cluster through Docker; does not apply lab workloads.
const cluster = new command.local.Command("kind-cluster", {
  create: `mkdir -p "$(dirname '${kubeconfigPath}')" && kind create cluster --name '${clusterName}' --config '${kindConfigPath}' --kubeconfig '${kubeconfigPath}'`,
  delete: `kind delete cluster --name '${clusterName}'`,
  triggers: [clusterName],
});

export const name = clusterName;
export const kubeconfig = kubeconfigPath;
export const creationStdout = cluster.stdout;
