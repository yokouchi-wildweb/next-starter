// 1 ドメインの生成: 読む（context）→ 検査（checks）→ 作る（plan）→ 登録表の事前検査 → 書く（apply）→ serviceRegistry を作り直す。
// 主と従属の組（pairs.mjs）に属するドメインは組の全員を「従属 → 主」の順に生成する（generateWithPairs）。
// 対話（-i の生成方法の選択・上書き確認）は cli/generate.mjs。ここは対話の有無によらず同じ

import path from "node:path";
import { preflightIssues, preflightWarnings } from "../checks/index.mjs";
import { createDomainContext } from "../domain/context.mjs";
import { FEATURE_MAP_FILE, buildFeatureMap } from "../domain/featureMap.mjs";
import { file } from "../render/output.mjs";
import { generateTargets, isHandManaged, narrowGenerateTargets } from "../spec/categories.mjs";
import { applyOutputs } from "./apply.mjs";
import { reportDryRun, summarizeDryRun } from "./dryRun.mjs";
import { assertPairs, collectionChildrenOf, groupOf, pairSummary, printPairNotices, resolvePairs } from "./pairs.mjs";
import { planDomain } from "./plan.mjs";
import { precheckServiceRegistry, regenerateServiceRegistry } from "./serviceRegistry.mjs";

/** core のドメインは生成物の import（@/features/<camel>/...）に tsconfig.json の paths の別名が要る。無ければエラー文 */
function coreAliasIssue(workspace, ctx) {
  if (ctx.kind !== "core") return null;
  const tsconfig = path.join(workspace.rootDir, "tsconfig.json");
  const alias = `"@/features/${ctx.camel}/*"`;
  if (workspace.exists(tsconfig) && workspace.readText(tsconfig).includes(alias)) return null;
  return (
    `[${ctx.camel}] core のドメインの生成物は @/features/${ctx.camel}/... で import します。` +
    `tsconfig.json の compilerOptions.paths に ${alias}: ["./src/features/core/${ctx.camel}/*"] を足してください（生成器は tsconfig.json を書きません）`
  );
}

/**
 * domain.json を読み、生成前の検査を通す。フォルダ名のずれ・廃止した型・Firestore のメディア列などは何も書く前に止める。
 * 語彙のずれ（綴り違い・古いキー・その DB に無い型）は警告して続ける。
 * 手で管理（generate: false）のドメインは検査もしない（生成器を一切通さない。configTargets が何も書かないことを 1 行出す）
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
  if (isHandManaged(ctx.config)) return ctx;
  const issues = [...preflightIssues(ctx), coreAliasIssue(workspace, ctx)].filter(Boolean);
  if (issues.length > 0) throw new Error(issues.join("\n"));
  for (const warning of preflightWarnings(ctx)) io.warn(warning);
  return ctx;
}

/**
 * 生成カテゴリを `--only` で絞り、絞られて生成しないカテゴリを知らせる
 * @param {Record<string, boolean>} gen generateTargets または手動選択
 * @param {string[] | null} only
 */
export function narrowTargets(ctx, gen, only, io = console) {
  if (isHandManaged(ctx.config)) {
    io.log(`[${ctx.camel}] generate: false（手で管理）のため何も書きません（作り直すときは generate を true に戻す）`);
    return generateTargets(ctx.config);
  }
  const { gen: narrowed, skipped } = narrowGenerateTargets(gen, only ?? null);
  if (skipped.length > 0) {
    io.log(`[${ctx.camel}] このドメインでは生成しないカテゴリのためスキップ: ${skipped.join(", ")}`);
  }
  if (narrowed.registry && ctx.kind === "core") {
    io.log(
      `[${ctx.camel}] core のドメインなので src/registry/ には書きません（domainEntry.ts は書く）。` +
        `テーブルがあれば src/registry/schemaRegistry.ts の CORE DOMAINS に export * from "@/features/${ctx.camel}/entities/drizzle"; を手で足してください`,
    );
  }
  return narrowed;
}

/**
 * domain.json の generate（と集まりの従属か）で決まるカテゴリを `--only` で絞る。generate: false は --only でも何も生成しない
 * @param {import("./pairs.mjs").PairIndex} pairs
 */
export function configTargets(ctx, pairs, only, io = console) {
  return narrowTargets(ctx, generateTargets(ctx.config, { child: pairs.ownerOf.has(ctx.camel) }), only, io);
}

/** ドメインの一覧（src/features/feature-map.txt）を書き直し、変わったら知らせる（dc:generate の書き込みの最後） */
export function refreshFeatureMap(workspace, io = console) {
  const content = buildFeatureMap(workspace.featureListing());
  if (workspace.readFeatureMap() === content) return false;
  applyOutputs([file(workspace.featureMapPath, content, { label: `✓ ${FEATURE_MAP_FILE} を書き直しました` })], io);
  return true;
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
  if (!deferServiceRegistry) refreshFeatureMap(workspace, io);
  return { registry: Boolean(gen.registry) };
}

/**
 * 1 ドメインの dc:generate。組に属さなければ generateDomain と同じ。組なら全員を plan してから登録表の事前検査をまとめて行い、
 * 従属 → 主の順に書き、serviceRegistry.ts を最後に 1 回作り直して一覧を出す。
 * 対象の生成カテゴリ（gen）は対象だけに使い、組の他の員は自分の generate で決まるカテゴリを --only で絞ったもの
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
    return { ctx: memberCtx, gen: configTargets(memberCtx, pairs, only, io) };
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
  if (!dryRun) refreshFeatureMap(workspace, io);
  io.log("");
  for (const line of pairSummary(workspace, pairs, group, { registry, dryRun })) io.log(line);
  return { registry };
}
