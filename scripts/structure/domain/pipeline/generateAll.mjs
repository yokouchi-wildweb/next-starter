// 複数ドメインの一括生成。全ドメインの生成物を先に組み立て、登録表（serviceRegistry.ts）が作れることを確かめてから書く。
// serviceRegistry.ts は最後に 1 回だけ作り直す。
// 主と従属の組（pairs.mjs）を一度解く。従属は主のドメインの中の登録(D334)なので、この実行で書き出す従属は主のドメインの生成の単位に加わる

import path from "node:path";

import { assertDomainFolderNames } from "../checks/domainFolder.mjs";
import { applyOutputs } from "./apply.mjs";
import { reportDryRun, summarizeDryRun } from "./dryRun.mjs";
import { isHandManaged } from "../spec/categories.mjs";
import { configTargets, loadDomainForGenerate, narrowTargets, refreshDistrictMap } from "./generate.mjs";
import { assertPairs, collectionChildrenOf, involvesPairs, pairSummary, pendingChildrenIn, printPairNotices, resolvePairs } from "./pairs.mjs";
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
  const domains = [...new Set(selectedDomains)];
  // 生成の単位 = ドメインの中の登録 1 件(D336): 主の登録(登録名 = ドメイン名)は今までどおり、ほかの生成する登録はその名前で(主が先)、
  // この実行で書き出す従属(まだディスクに無い)はその後
  const units = domains.flatMap((domain) => {
    const onDisk = workspace.generationUnitsOf(domain);
    const registrations = [...onDisk.filter((registration) => registration !== domain), ...pendingChildrenIn(pairs, domain)];
    const own = onDisk.includes(domain) || registrations.length === 0;
    return [...(own ? [{ domain, registration: null }] : []), ...registrations.map((registration) => ({ domain, registration }))].map((unit, index) => ({ ...unit, firstUnit: index === 0 }));
  });
  const registrationsOfRun = units.map((unit) => unit.registration ?? unit.domain);
  printPairNotices(pairs, registrationsOfRun, io);
  const plans = units.map(({ domain, registration, firstUnit }) => {
    const { buffer, flush } = bufferedIo(io);
    const pendingConfig = registration ? pairs.pending.get(registration) : undefined;
    const overrides = registration ? { registration, firstUnit, ...(pendingConfig ? { config: pendingConfig } : {}) } : {};
    const ctx = loadDomainForGenerate(workspace, domain, buffer, overrides);
    const gen = manualGenerate ? narrowTargets(ctx, manualGenerate, only, buffer, { junction: pairs.junctions.has(ctx.camel) }) : configTargets(ctx, pairs, only, buffer);
    ctx.collectionChildren = collectionChildrenOf(workspace, pairs, ctx.camel);
    return { domain: registration ? `${domain}/${registration}` : domain, ctx, gen, outputs: planDomain(ctx, workspace, gen), flush };
  });
  return { pairs, domains, registrations: registrationsOfRun, plans };
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
  const { pairs, registrations, plans } = planGenerateAll(workspace, selectedDomains, manualGenerate, only, io);
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

  const summary = involvesPairs(pairs, registrations) ? pairSummary(workspace, pairs, registrations, { registry: registryGenerated, dryRun }) : [];
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
