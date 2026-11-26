// 複数ドメインの一括生成。全ドメインの生成物を先に組み立て、登録表（serviceRegistry.ts）が作れることを確かめてから書く。
// serviceRegistry.ts は最後に 1 回だけ作り直す。
// 主と従属の組（pairs.mjs）を一度解き、この実行で書き出す従属も加えて、従属を所有する主の直前に並べる（それ以外の順は変えない）

import path from "node:path";

import { assertDomainFolderNames } from "../checks/domainFolder.mjs";
import { applyOutputs } from "./apply.mjs";
import { reportDryRun, summarizeDryRun } from "./dryRun.mjs";
import { isHandManaged } from "../spec/categories.mjs";
import { configTargets, loadDomainForGenerate, narrowTargets, refreshDistrictMap } from "./generate.mjs";
import { assertPairs, collectionChildrenOf, groupOf, involvesPairs, orderWithPairs, pairSummary, printPairNotices, resolvePairs } from "./pairs.mjs";
import { planDomain } from "./plan.mjs";
import { precheckServiceRegistry, regenerateServiceRegistry } from "./serviceRegistry.mjs";

/** ドメインごとのメッセージを溜めて、そのドメインの番が来たら出す（組み立てと書き込みを分けても出力順を保つ） */
function bufferedIo(io) {
  const lines = [];
  return { buffer: { log: (m) => lines.push(m), warn: (m) => io.warn(m) }, flush: () => lines.forEach((m) => io.log(m)) };
}

/**
 * 一括生成の組み立て(書かない): 全件の検査 → 組を解く → ドメインごとの生成物(Output)。runGenerateAll の 1 段目で、
 * 生成物の印の検査(scripts/workflow/rules/generated.mjs)も同じ計画を読む(生成器が実際に書くファイルだけを生成物と数える)
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string[]} selectedDomains フォルダ名
 * @param {Record<string, boolean> | null} manualGenerate 手動選択（null = 各登録の entity.json の generate で決まるカテゴリ）
 * @param {string[] | null} only --only
 * @param {{ log: Function, warn: Function }} [io]
 */
export function planGenerateAll(workspace, selectedDomains, manualGenerate, only, io = console) {
  // 途中のドメインで止まって生成が半端に残らないよう、ループの前に全件を検査する
  // 手で管理（generate: false）のドメインは検査もしない（生成器を一切通さない）
  assertDomainFolderNames(workspace, selectedDomains.filter((domain) => !isHandManaged(workspace.readConfigLenient(domain))));
  const pairs = resolvePairs(workspace);
  assertPairs(pairs);
  // 選んだドメインの組の全員（この実行で書き出す従属・選んだ従属の主）を加え、従属 → 主の順に並べる
  const domains = orderWithPairs(pairs, [...new Set(selectedDomains.flatMap((domain) => groupOf(pairs, domain)))]);
  printPairNotices(pairs, domains, io);
  const plans = domains.map((domain) => {
    const { buffer, flush } = bufferedIo(io);
    const ctx = loadDomainForGenerate(workspace, domain, buffer, pairs.pending.has(domain) ? { config: pairs.pending.get(domain) } : {});
    const gen = manualGenerate ? narrowTargets(ctx, manualGenerate, only, buffer) : configTargets(ctx, pairs, only, buffer);
    ctx.collectionChildren = collectionChildrenOf(workspace, pairs, domain);
    return { domain, ctx, gen, outputs: planDomain(ctx, workspace, gen), flush };
  });
  return { pairs, domains, plans };
}

/**
 * 計画の毎回書き直す出力(Output の kind "file")のパス(リポの根からの相対、/ 区切り)
 * @param {{ outputs: import("../render/output.mjs").Output[] }[]} plans
 * @param {string} rootDir
 * @returns {Set<string>}
 */
export function everyRunPathsOf(plans, rootDir) {
  return new Set(
    plans.flatMap((plan) => plan.outputs.filter((o) => o.kind === "file").map((o) => path.relative(rootDir, o.path).split(path.sep).join("/"))),
  );
}

/**
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string[]} selectedDomains フォルダ名
 * @param {Record<string, boolean> | null} manualGenerate 手動選択（null = 各登録の entity.json の generate で決まるカテゴリ）
 * @param {string[] | null} only --only
 * @param {{ dryRun?: boolean, io?: { log: Function, warn: Function } }} [options]
 */
export function runGenerateAll(workspace, selectedDomains, manualGenerate, only, { dryRun = false, io = console } = {}) {
  // 1. 全ドメインの生成物を組み立てる（ここで検査に落ちれば何も書かない）
  const { pairs, domains, plans } = planGenerateAll(workspace, selectedDomains, manualGenerate, only, io);
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

  const summary = involvesPairs(pairs, domains) ? pairSummary(workspace, pairs, domains, { registry: registryGenerated, dryRun }) : [];
  if (dryRun) {
    if (summary.length) io.log("");
    summary.forEach((line) => io.log(line));
    io.log(`\n[dry-run] 何も書いていません。${registryGenerated ? "実行時は最後に serviceRegistry.ts を 1 回作り直します。" : ""}`);
    return;
  }

  if (registryGenerated) {
    io.log("");
    regenerateServiceRegistry(workspace);
  }
  refreshDistrictMap(workspace, io);
  if (registryGenerated) io.log("src/registry の一覧は pnpm generate registry で作り直してください");

  if (summary.length) io.log("");
  summary.forEach((line) => io.log(line));
  io.log("\nすべてのドメインのファイル生成が完了しました。");
}
