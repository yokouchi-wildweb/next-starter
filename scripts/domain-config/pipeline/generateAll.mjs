// 複数ドメインの一括生成。全件のフォルダ名を先に検査し、serviceRegistry.ts は最後に 1 回だけ作り直す

import { assertDomainFolderNames } from "../checks/domainFolder.mjs";
import { generateDomain, loadDomainForGenerate, narrowTargets } from "./generate.mjs";
import { regenerateServiceRegistry } from "./serviceRegistry.mjs";

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string[]} selectedDomains フォルダ名
 * @param {Record<string, boolean> | null} manualGenerate 手動選択（null = 各 domain.json の generateFiles）
 * @param {string[] | null} only --only
 */
export function runGenerateAll(workspace, selectedDomains, manualGenerate, only, io = console) {
  // 途中のドメインで止まって生成が半端に残らないよう、ループの前に全件を検査する
  assertDomainFolderNames(workspace, selectedDomains);
  let registryGenerated = false;
  for (const domain of selectedDomains) {
    io.log(`\n[${domain}] の生成を開始します。`);
    const ctx = loadDomainForGenerate(workspace, domain, io);
    const gen = narrowTargets(ctx, manualGenerate ?? ctx.config.generateFiles ?? {}, only, io);
    const result = generateDomain(ctx, workspace, gen, { deferServiceRegistry: true, io });
    if (result.registry) registryGenerated = true;
  }

  if (registryGenerated) {
    io.log("");
    regenerateServiceRegistry(workspace);
  }

  io.log("\nすべてのドメインのファイル生成が完了しました。");
}
