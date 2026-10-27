// dc:generate:service: 複数ドメインを選び、クライアント / サーバー / ベースサービスを個別に選んで生成する。
// サーバーサービス（<domain>Service.ts）を明示的に選んだときは、書き捨てのファイルも上書きする

import { createDomainContext } from "../../domain/context.mjs";
import { createWorkspace } from "../../domain/workspace.mjs";
import { applyOutputs } from "../../pipeline/apply.mjs";
import { renderClientServices } from "../../render/clientServices/index.mjs";
import { renderServerServices } from "../../render/serverServices/index.mjs";
import { confirmSelection, prompt, selectDomains } from "../prompts.mjs";

const SERVICE_CHOICES = [
  { name: "xxxClient.ts（クライアントサービス）", value: "clientService" },
  { name: "xxxService.ts（サーバーサービス・既存も上書き）", value: "serverService" },
  { name: "drizzleBase.ts / firestoreBase.ts（ベースサービス）", value: "baseService" },
];

function generateServicesFor(workspace, domain, selectedServices) {
  const ctx = createDomainContext(workspace, domain);
  const outputs = [];
  if (selectedServices.includes("clientService")) {
    outputs.push(...renderClientServices(ctx, workspace));
  }
  const targets = { base: selectedServices.includes("baseService"), service: selectedServices.includes("serverService") };
  if (targets.base || targets.service) {
    outputs.push(...renderServerServices(ctx, workspace, { targets, overwriteService: targets.service }));
  }
  applyOutputs(outputs);
}

export async function runPickServices() {
  const workspace = createWorkspace();
  const domains = workspace.listDomains();
  if (domains.length === 0) {
    console.log("domain.json を含むドメインが存在しません。");
    return;
  }

  const selectedDomains = await selectDomains(domains);
  if (!selectedDomains.length) {
    console.log("生成対象が選択されなかったため、キャンセルしました。");
    return;
  }

  const { selectedServices } = await prompt({
    type: "checkbox",
    name: "selectedServices",
    message: "生成するサービスを選択してください（スペースで選択／Enterで確定）:",
    choices: SERVICE_CHOICES,
    default: ["clientService", "serverService", "baseService"],
    loop: false,
  });
  if (!selectedServices.length) {
    console.log("生成対象のサービスが選択されなかったため、キャンセルしました。");
    return;
  }

  console.log(`\n対象ドメイン（${selectedDomains.length}件）:`);
  selectedDomains.forEach((domain) => {
    const config = workspace.readConfig(domain);
    console.log(`  - ${domain} (${config?.dbEngine || "Neon"})`);
  });
  console.log(`\n生成するサービス（${selectedServices.length}件）:`);
  selectedServices.forEach((service) => console.log(`  - ${SERVICE_CHOICES.find((c) => c.value === service)?.name || service}`));
  const { confirmGenerate } = await prompt({
    type: "confirm",
    name: "confirmGenerate",
    message: "\n選択した内容で生成を実行しますか？既存ファイルは上書きされます。",
    default: false,
  });
  if (!confirmGenerate) {
    console.log("生成をキャンセルしました。");
    return;
  }

  for (const domain of selectedDomains) {
    console.log(`\n[${domain}] のサービス生成を開始します。`);
    generateServicesFor(workspace, domain, selectedServices);
  }
  console.log("\nすべてのサービス生成が完了しました。");
}
