// 複数ドメインの一括生成。全ドメインの生成物を先に組み立て、登録表（serviceRegistry.ts）が作れることを確かめてから書く。
// serviceRegistry.ts は最後に 1 回だけ作り直す

import { assertDomainFolderNames } from "../checks/domainFolder.mjs";
import { applyOutputs } from "./apply.mjs";
import { reportDryRun, summarizeDryRun } from "./dryRun.mjs";
import { loadDomainForGenerate, narrowTargets } from "./generate.mjs";
import { planDomain } from "./plan.mjs";
import { precheckServiceRegistry, regenerateServiceRegistry } from "./serviceRegistry.mjs";

/** ドメインごとのメッセージを溜めて、そのドメインの番が来たら出す（組み立てと書き込みを分けても出力順を保つ） */
function bufferedIo(io) {
  const lines = [];
  return { buffer: { log: (m) => lines.push(m), warn: (m) => io.warn(m) }, flush: () => lines.forEach((m) => io.log(m)) };
}

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string[]} selectedDomains フォルダ名
 * @param {Record<string, boolean> | null} manualGenerate 手動選択（null = 各 domain.json の generateFiles）
 * @param {string[] | null} only --only
 * @param {{ dryRun?: boolean, io?: { log: Function, warn: Function } }} [options]
 */
export function runGenerateAll(workspace, selectedDomains, manualGenerate, only, { dryRun = false, io = console } = {}) {
  // 途中のドメインで止まって生成が半端に残らないよう、ループの前に全件を検査する
  assertDomainFolderNames(workspace, selectedDomains);

  // 1. 全ドメインの生成物を組み立てる（ここで検査に落ちれば何も書かない）
  const plans = selectedDomains.map((domain) => {
    const { buffer, flush } = bufferedIo(io);
    const ctx = loadDomainForGenerate(workspace, domain, buffer);
    const gen = narrowTargets(ctx, manualGenerate ?? ctx.config.generateFiles ?? {}, only, buffer);
    return { domain, ctx, gen, outputs: planDomain(ctx, workspace, gen), flush };
  });
  const registryGenerated = plans.some((plan) => plan.gen.registry);

  // 2. 書いた後の状態で登録表が作れるかを先に確かめる
  if (registryGenerated && !dryRun) {
    precheckServiceRegistry(workspace, plans.flatMap((plan) => plan.outputs));
  }

  // 3. 書く（または一覧する）
  for (const { domain, ctx, gen, outputs, flush } of plans) {
    io.log(`\n[${domain}] の生成を開始します。`);
    flush();
    if (dryRun) {
      const counts = reportDryRun(outputs, workspace, io);
      io.log(`[dry-run] ${ctx.camel}: ${summarizeDryRun(counts) || "書くものなし"}${gen.registry ? "（serviceRegistry.ts は実行時に作り直す）" : ""}`);
    } else {
      applyOutputs(outputs, io);
    }
  }

  if (dryRun) {
    io.log(`\n[dry-run] 何も書いていません。${registryGenerated ? "実行時は最後に serviceRegistry.ts を 1 回作り直します。" : ""}`);
    return;
  }

  if (registryGenerated) {
    io.log("");
    regenerateServiceRegistry(workspace);
  }

  io.log("\nすべてのドメインのファイル生成が完了しました。");
}
