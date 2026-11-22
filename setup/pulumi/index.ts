import * as pulumi from "@pulumi/pulumi";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import * as command from "@pulumi/command";

const config = new pulumi.Config();
const clusterName = config.get("clusterName") ?? "k8s-lab";
const kindConfigPath = "../kind-config.yaml";
const kubeconfigPath = "../../setup/.kube/kubeconfig";
const kindConfigHash = createHash("sha256").update(readFileSync(kindConfigPath)).digest("hex");

// Creates a local kind cluster through Docker; does not apply lab workloads.
const cluster = new command.local.Command("kind-cluster", {
  create: `mkdir -p "$(dirname '${kubeconfigPath}')" && kind create cluster --name '${clusterName}' --config '${kindConfigPath}' --kubeconfig '${kubeconfigPath}'`,
  delete: `kind delete cluster --name '${clusterName}' --kubeconfig '${kubeconfigPath}'`,
  triggers: [clusterName, kubeconfigPath, kindConfigHash],
});

export const name = clusterName;
export const kubeconfig = kubeconfigPath;
export const creationStdout = cluster.stdout;
