// 1 ドメインの生成: 読む（context）→ 検査（checks）→ 作る（plan）→ 登録表の事前検査 → 書く（apply）→ serviceRegistry を作り直す。
// 主と従属の組（pairs.mjs）に属するドメインは組の全員を「従属 → 主」の順に生成する（generateWithPairs）。
// 対話（生成方法の選択・上書き確認）は cli/generate.mjs。ここは --yes でも対話でも同じ

import { assertPreflight, preflightWarnings } from "../checks/index.mjs";
import { createDomainContext } from "../domain/context.mjs";
import { narrowGenerateTargets } from "../spec/categories.mjs";
import { applyOutputs } from "./apply.mjs";
import { reportDryRun, summarizeDryRun } from "./dryRun.mjs";
import { assertPairs, collectionChildrenOf, groupOf, pairSummary, printPairNotices, resolvePairs } from "./pairs.mjs";
import { planDomain } from "./plan.mjs";
import { precheckServiceRegistry, regenerateServiceRegistry } from "./serviceRegistry.mjs";

/**
 * domain.json を読み、生成前の検査を通す。フォルダ名のずれ・Firestore のメディア列は何も書く前に止める。
 * 語彙のずれ（綴り違い・古いキー・その DB に無い型）は警告して続ける
 * @returns {import("../domain/context.mjs").DomainContext}
 */
export function loadDomainForGenerate(workspace, domainInput, io = console, overrides = {}) {
  const input = (domainInput || "").trim();
  if (!input) {
    throw new Error("ドメイン名を指定してください。");
  }
  // overrides.config = この実行で書き出す従属の domain.json の中身（まだディスクに無い）
  const ctx = createDomainContext(workspace, input, overrides);
  if (!ctx.config) {
    throw new Error(`設定ファイルが見つかりません: ${ctx.configPath}`);
  }
  assertPreflight(ctx);
  for (const warning of preflightWarnings(ctx)) io.warn(warning);
  return ctx;
}

/**
 * 生成カテゴリを `--only` で絞り、絞られて生成しないカテゴリを知らせる
 * @param {Record<string, boolean>} gen generateFiles または手動選択
 * @param {string[] | null} only
 */
export function narrowTargets(ctx, gen, only, io = console) {
  const { gen: narrowed, skipped } = narrowGenerateTargets(gen, only ?? null);
  if (skipped.length > 0) {
    io.log(`[${ctx.camel}] generateFiles で無効のためスキップ: ${skipped.join(", ")}`);
  }
  return narrowed;
}

/**
 * @param {import("../domain/context.mjs").DomainContext} ctx
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {Record<string, boolean>} gen 生成するカテゴリ
 * @param {{ deferServiceRegistry?: boolean, dryRun?: boolean, io?: { log: Function, warn: Function } }} [options]
 *   deferServiceRegistry = 一括生成が全ドメインの domainEntry.ts を書いた後に serviceRegistry.ts を 1 回だけ作り直す
 *   （ドメインごとに作り直すと、まだ domainEntry.ts の無い他のドメインで検査が止まるため）
 *   dryRun = 書かずに、書くはずのファイルと動作（作成 / 上書き / 変更なし / 保持 / 移行）を一覧する
 * @returns {{ registry: boolean }} registry カテゴリを生成したか
 */
export function generateDomain(ctx, workspace, gen, { deferServiceRegistry = false, dryRun = false, io = console } = {}) {
  const outputs = planDomain(ctx, workspace, gen);
  if (dryRun) {
    const counts = reportDryRun(outputs, workspace, io);
    io.log(`[dry-run] ${ctx.camel}: ${summarizeDryRun(counts) || "書くものなし"}${gen.registry ? "（serviceRegistry.ts は実行時に作り直す）" : ""}`);
    return { registry: Boolean(gen.registry) };
  }
  // 登録表が作れない状態（手書き行・他ドメインの domainEntry.ts 欠け）なら、何も書かずに止める
  if (gen.registry && !deferServiceRegistry) {
    precheckServiceRegistry(workspace, outputs, { errorPrefix: "✗ " });
  }
  applyOutputs(outputs, io);
  if (gen.registry && !deferServiceRegistry) {
    regenerateServiceRegistry(workspace, { errorPrefix: "✗ " });
  }
  return { registry: Boolean(gen.registry) };
}

/**
 * 1 ドメインの dc:generate。組に属さなければ generateDomain と同じ。組なら全員を plan してから登録表の事前検査をまとめて行い、
 * 従属 → 主の順に書き、serviceRegistry.ts を最後に 1 回作り直して一覧を出す。
 * 対象の生成カテゴリ（gen）は対象だけに使い、組の他の員は自分の generateFiles を --only で絞ったもの
 * @param {{ only?: string[] | null, dryRun?: boolean, io?: { log: Function, warn: Function }, pairs?: import("./pairs.mjs").PairIndex }} [options]
 *   pairs = 解いた組（対話の確認の前に組の誤りを出すため、呼び出し側が先に解いて渡してよい）
 */
export function generateWithPairs(ctx, workspace, gen, { only = null, dryRun = false, io = console, pairs = resolvePairs(workspace) } = {}) {
  const group = groupOf(pairs, ctx.camel);
  assertPairs(pairs, group);
  if (group.length === 1) return generateDomain(ctx, workspace, gen, { dryRun, io });
  printPairNotices(pairs, group, io);

  const members = group.map((domain) => {
    if (domain === ctx.camel) return { ctx, gen };
    const memberCtx = loadDomainForGenerate(workspace, domain, io, pairs.pending.has(domain) ? { config: pairs.pending.get(domain) } : {});
    return { ctx: memberCtx, gen: narrowTargets(memberCtx, memberCtx.config.generateFiles ?? {}, only, io) };
  });
  // 主の生成物（Fields）が従属の file を読む
  for (const member of members) member.ctx.collectionChildren = collectionChildrenOf(workspace, pairs, member.ctx.camel);
  const plans = members.map((member) => ({ ...member, outputs: planDomain(member.ctx, workspace, member.gen) }));
  const registry = plans.some((plan) => plan.gen.registry);
  if (registry && !dryRun) {
    precheckServiceRegistry(workspace, plans.flatMap((plan) => plan.outputs), { errorPrefix: "✗ " });
  }
  for (const plan of plans) {
    io.log(`\n[${plan.ctx.camel}] の生成を開始します。`);
    if (dryRun) {
      const counts = reportDryRun(plan.outputs, workspace, io);
      io.log(`[dry-run] ${plan.ctx.camel}: ${summarizeDryRun(counts) || "書くものなし"}`);
    } else {
      applyOutputs(plan.outputs, io);
    }
  }
  if (registry && !dryRun) regenerateServiceRegistry(workspace, { errorPrefix: "✗ " });
  io.log("");
  for (const line of pairSummary(workspace, pairs, group, { registry, dryRun })) io.log(line);
  return { registry };
}
