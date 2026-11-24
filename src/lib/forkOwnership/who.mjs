// pnpm workflow ownership who の本体: パスごとに持ち主・できること・根拠を答える(読むだけ。リポのファイルは書かない)。
// 判定は pnpm workflow ownership check と同じ部品(resolveForkContext・judgeFork・judge・受け口の一覧)を使い、規則の表を別に持たない。
// 表示と終了コードは whoCli.mjs。仕様: ./README.md「持ち主を調べる(pnpm workflow ownership who)」

import { execFileSync } from "node:child_process";

import { existsAt, filesUnder, forkIdAt, INTAKE_PATH, judgeFork, reassignMiddleTier, resolveForkContext, treeSnapshot } from "./check.mjs";
import { overridePathOfTarget } from "../districtMap/index.mjs";
import { explainPath, explainView } from "./explain.mjs";
import { matchIntake, parseIntake } from "./intake.mjs";
import { judge } from "./judge.mjs";
import { unitName } from "./unitNames.mjs";

/**
 * @import { Tier1Version, Unverified } from "./check.mjs"
 * @import { ExplainAnswer, ExplainTier } from "./explain.mjs"
 * @import { IntakeRule } from "./intake.mjs"
 * @import { OwnershipEntry } from "./judge.mjs"
 * @import { Permit } from "./permits.mjs"
 * @typedef {ReturnType<typeof describePath>} WhoResult 1 パスの答え
 * @typedef {Unverified
 *   | { status: "tier1", ownerId: string, read: WhoRead, results: WhoResult[] }
 *   | { status: "ok", ownerId: string, remote: string, branch: string, base: string, tier1: Tier1Version, read: WhoRead, results: WhoResult[] }} WhoAnswer whoOwns の結果
 * @typedef {{ base: string | null, head: string | null }} WhoRead 答えが読んだ版(base = 受け口の一覧・phase.json・木を読んだ版、head = 作業の HEAD)
 */

/**
 * 受け口の kind → 書き換えてよい範囲(既存のファイル)
 * @type {Readonly<Record<string, string | undefined>>}
 */
const EDIT_BY_KIND = {
  edit: "受け口(edit): 書き換えてよい",
  region: "fork の区画(fork entries start … end)の中だけ",
  marker: "`fork entries below` の行より下だけ",
  append: "基準の中身を先頭に残した追記だけ",
  "append-json": "鍵を足すだけ(上流の鍵を消さない・上流の値を変えない。例外は judge.mjs JSON_FREE_KEYS: package.json の name・依存 4 欄の上流の依存の版の範囲)",
  generated: "生成物: 生成器で作り直す(手で直さない)",
};

/**
 * @param {string} repoRoot
 * @param {string} rev
 * @param {string} path
 * @returns {string | null}
 */
const showAt = (repoRoot, rev, path) => {
  try {
    return execFileSync("git", ["show", `${rev}:${path}`], { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return null;
  }
};
/** @param {string} repoRoot @param {string} path */
const showHead = (repoRoot, path) => showAt(repoRoot, "HEAD", path);
/**
 * 版の sha(無い版は null)
 * @param {string} repoRoot
 * @param {string} rev
 * @returns {string | null}
 */
const revSha = (repoRoot, rev) => {
  try {
    return execFileSync("git", ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim() || null;
  } catch {
    return null;
  }
};

/**
 * 丸ごと置き換え <名前>.replace の候補(<名前>.default の隣も同じ名前)。.replace / .override 自身は null
 * @param {string} path
 * @returns {string | null}
 */
export function replaceCandidate(path) {
  const match = /\.(tsx?)$/.exec(path);
  if (!match) return null;
  const unit = unitName(path);
  if (/\.(replace|override)$/.test(unit)) return null;
  return `${unit.replace(/\.default$/, "")}.replace.${match[1]}`;
}

/**
 * 一部の上書き <対象>.override.ts の候補(cron のフォルダは上書きできるのが task.ts だけなので、どのファイルも task.override.ts)。.override 自身は null
 * @param {string} path
 * @returns {string | null}
 */
export function overrideCandidate(path) {
  const cron = /^(src\/app\/api\/cron\/[^/]+)\/[^/]+$/.exec(path);
  if (cron) return /\.override\.tsx?$/.test(path) ? null : `${cron[1]}/task.override.ts`;
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name.lastIndexOf(".") <= 0 || /\.(override|replace)\.[^.]+$/.test(name)) return null;
  return overridePathOfTarget(path);
}

/**
 * 1 パスの答え(git に触れない)。
 * @param {{
 *   path: string,
 *   inBase: boolean, inHead: boolean, inTier1: boolean,
 *   middleName: string | null,           // 基準にあり Tier1 の版に無いファイルを足した Tier の名前
 *   intake: IntakeRule[],                // 基準の受け口の一覧(parseIntake().rules)
 *   entry: OwnershipEntry | null,        // 基準との差分の判定(judgeFork の entries の 1 件、差分が無ければ null)
 *   permit: Permit | null,               // 自分の一時許可の行(parsePermits の 1 件)
 *   judgeAdd: (path: string) => { reason: string, verdict: string },  // そのパスを足したときの判定(中間 Tier の付け替え込み)
 *   explain?: (path: string, who: { tier: ExplainTier, addable: boolean }) => ExplainAnswer,  // 型の答え(explain.mjs の explainPath を木と直接の親に結んだ物)
 * }} input
 */
export function describePath({ path, inBase, inHead, inTier1, middleName, intake, entry, permit, judgeAdd, explain }) {
  const rule = matchIntake(intake, path);
  /** @type {ExplainTier} */
  const tier = !inBase ? (inHead ? "fork" : "missing") : inTier1 ? "tier1" : "middle";
  /** @type {{ kind: string, tier: ExplainTier, forkId?: string | null }} */
  const owner = { kind: rule?.kind === "generated" && tier !== "missing" ? "generated" : tier, tier, ...(tier === "middle" ? { forkId: middleName } : {}) };
  const editHow = rule?.kind ? EDIT_BY_KIND[rule.kind === "append" && path.endsWith(".json") ? "append-json" : rule.kind] : undefined;

  /** @type {{ action: string, how: string, path?: string }[]} */
  const allowed = [];
  /** @type {{ action: string, reason: string }[]} */
  const blocked = [];
  if (tier === "missing") {
    const added = judgeAdd(path);
    if (added.verdict === "ok") allowed.push({ action: "add", how: added.reason === "middle-tier" ? "足してよい(中間 Tier の物の中)" : "足してよい" });
    else blocked.push({ action: "add", reason: added.reason });
  } else if (tier === "fork") {
    allowed.push({ action: "edit", how: "fork が足したファイル: 書き換え・削除・rename してよい" });
  } else if (tier === "middle") {
    allowed.push({ action: "edit", how: `中間 Tier${middleName ? ` ${middleName}` : ""} の物: 書き換え・削除・rename してよい(D29)` });
  } else if (rule && editHow) {
    allowed.push({ action: "edit", how: editHow });
  } else {
    blocked.push({ action: "edit", reason: rule?.kind === "debt" ? "debt" : "outside-intake" });
  }

  // 丸ごと置き換え・一部の上書き: 受け口の一覧にその口を名指しする行(glob に .replace / override を含む)があり、
  // 足したときの判定が合格のときだけ(src/config/** のような広い edit の行で上書きの口があるとは言わない)
  if (tier !== "missing" && tier !== "fork") {
    const replace = replaceCandidate(path);
    const replaceRule = replace ? matchIntake(intake, replace) : null;
    if (replace && replaceRule?.kind === "add" && replaceRule.glob.includes(".replace") && judgeAdd(replace).verdict === "ok") {
      allowed.push({ action: "replace", how: `${replace} を足し、1 行スイッチを向け替える`, path: replace });
    }
    const override = overrideCandidate(path);
    const overrideRule = override ? matchIntake(intake, override) : null;
    if (override && (overrideRule?.kind === "edit" || overrideRule?.kind === "add") && overrideRule.glob.includes("override") && judgeAdd(override).verdict === "ok") {
      allowed.push({ action: "override", how: `${override} で上書きする`, path: override });
    }
  }
  if (allowed.length === 0) allowed.push({ action: "none", how: "受け口が無い → /order <直接の親>(要るまでの間は一時許可)" });

  const evidence = {
    inBase,
    inHead,
    inTier1,
    intake: rule ? { line: rule.line, kind: rule.kind, glob: rule.glob, note: rule.note } : null,
    permit: permit ? { line: permit.line, upreqs: permit.upreqs, state: entry?.permit ?? (entry ? "none" : "unused") } : null,
    current: entry
      ? { status: entry.status, ...(entry.from ? { from: entry.from } : {}), reason: entry.reason, verdict: entry.verdict, ...(entry.permitDraft ? { permitDraft: entry.permitDraft } : {}) }
      : null,
  };
  // 型(1-4 | generated | own | none)・鍵・置くファイル: fork がこのパスを変えたいときにすること
  const typed = explain ? explain(path, { tier, addable: tier === "missing" && judgeAdd(path).verdict === "ok" }) : null;
  // kind = 受け口の一覧の行の種類(D312 の答えの欄)、generated = 生成器の名前・命令・範囲(種類と別の欄、explain.mjs)
  return { path, owner, kind: rule?.kind ?? null, generated: typed?.generated ?? null, ...(typed ?? {}), allowed, blocked, evidence };
}

/**
 * 引数のパスを repo 相対のファイルに広げる(フォルダ = その下のファイル、HEAD ∪ 基準)
 * @param {string} repoRoot
 * @param {string[]} paths
 * @param {string[]} revs
 * @returns {string[]}
 */
export function expandPaths(repoRoot, paths, revs) {
  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  const push = (/** @type {string} */ path) => {
    if (seen.has(path)) return;
    seen.add(path);
    out.push(path);
  };
  for (const raw of paths) {
    const path = raw.replace(/^\.\//, "").replace(/\/+$/, "");
    if (revs.some((rev) => existsAt(repoRoot, rev, path))) {
      push(path);
      continue;
    }
    const under = [...new Set(revs.flatMap((rev) => filesUnder(repoRoot, rev, path)))].sort();
    if (under.length === 0) push(path);
    for (const file of under) push(file);
  }
  return out;
}

/**
 * @param {string} repoRoot
 * @param {string[]} paths repo 相対(フォルダはその下のファイルに広げる)
 * @param {{ parent?: string, branch?: string, fetch?: boolean, base?: string }} [options] base = 基準にする版(既定: fork = 直接の親との merge-base、Tier1 = HEAD)
 * @returns {WhoAnswer}
 */
export function whoOwns(repoRoot, paths, options = {}) {
  const context = resolveForkContext(repoRoot, options);
  if (context.status === "unverified") return context;

  const head = revSha(repoRoot, "HEAD");
  if (context.status === "tier1") {
    // Tier1: このリポは全部自分の物。答えは「直接の fork から見たら」(HEAD か --base の版を基準に見立てる)
    const rev = options.base === undefined ? "HEAD" : revSha(repoRoot, options.base);
    if (rev === null) return { status: "unverified", reason: `基準の版 ${options.base} が無い`, ownerId: context.ownerId };
    const intake = parseIntake((rev === "HEAD" ? showHead(repoRoot, INTAKE_PATH) : showAt(repoRoot, rev, INTAKE_PATH)) ?? "");
    if (intake.errors.length > 0) return { status: "unverified", reason: `${INTAKE_PATH} に書式の誤りがある`, ownerId: context.ownerId, errors: intake.errors };
    const snapshot = treeSnapshot(repoRoot, rev);
    const files = new Set(snapshot.files);
    const judgeAdd = addJudge(snapshot, intake.rules, files);
    const view = explainView({ files: snapshot.files, read: snapshot.read, intake: intake.rules });
    /** @type {(path: string, who: { tier: ExplainTier, addable: boolean }) => ExplainAnswer} */
    const explain = (path, who) => explainPath(path, view, { ...who, parent: context.ownerId });
    const results = expandPaths(repoRoot, paths, [rev]).map((path) =>
      describePath({ path, inBase: files.has(path), inHead: files.has(path), inTier1: files.has(path), middleName: null, intake: intake.rules, entry: null, permit: null, judgeAdd, explain }),
    );
    return { status: "tier1", ownerId: context.ownerId, read: { base: rev === "HEAD" ? head : rev, head }, results };
  }

  const { entries, permits, snapshot } = judgeFork(repoRoot, context);
  const baseFiles = new Set(snapshot.files);
  const judgeAdd = addJudge(snapshot, context.intake, context.tier1Files);
  const chain = [...context.tier1.chain].reverse(); // Tier1 に近い版から
  const middleNameOf = (/** @type {string} */ path) => chain.find((step) => existsAt(repoRoot, step.sha, path))?.name ?? forkIdAt(repoRoot, context.base);
  const view = explainView({ files: snapshot.files, read: snapshot.read, intake: context.intake });
  const parent = forkIdAt(repoRoot, context.base) ?? context.remote;
  /** @type {(path: string, who: { tier: ExplainTier, addable: boolean }) => ExplainAnswer} */
  const explain = (path, who) => explainPath(path, view, { ...who, parent });

  const results = expandPaths(repoRoot, paths, ["HEAD", context.base]).map((path) => {
    const inBase = baseFiles.has(path);
    const inTier1 = context.tier1Files.has(path);
    const entry = entries.find((item) => item.path === path || item.from === path) ?? null;
    return describePath({
      path,
      inBase,
      inHead: existsAt(repoRoot, "HEAD", path),
      inTier1,
      middleName: inBase && !inTier1 ? middleNameOf(path) : null,
      intake: context.intake,
      entry,
      permit: permits.find((item) => item.path === path) ?? null,
      judgeAdd,
      explain,
    });
  });
  const { ownerId, remote, branch, base, tier1 } = context;
  return { status: "ok", ownerId, remote, branch, base, tier1, read: { base, head }, results };
}

/**
 * そのパスを足したときの判定(judge + 中間 Tier の付け替え。pnpm workflow ownership check と同じ)
 * @param {ReturnType<typeof treeSnapshot>} snapshot
 * @param {IntakeRule[]} intake
 * @param {Set<string>} tier1Files
 * @returns {(path: string) => OwnershipEntry}
 */
function addJudge(snapshot, intake, tier1Files) {
  return (path) => {
    const { entries } = judge({
      changes: [{ status: "A", path }],
      baseText: snapshot.read,
      headText: () => null,
      baseLibs: snapshot.libs,
      baseHasCore: snapshot.hasCore,
      baseHasGate: snapshot.hasGate,
      baseHasRulesCore: snapshot.hasRulesCore,
      intake,
      places: snapshot.places,
      baseUnits: snapshot.units,
    });
    reassignMiddleTier(entries, tier1Files);
    return entries[0];
  };
}
