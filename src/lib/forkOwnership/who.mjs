// pnpm ownership:who の本体: パスごとに持ち主・できること・根拠を答える(読むだけ。リポのファイルは書かない)。
// 判定は ownership:check と同じ部品(resolveForkContext・judgeFork・judge・受け口の一覧)を使い、規則の表を別に持たない。
// 表示と終了コードは whoCli.mjs。仕様: ./README.md「持ち主を調べる(ownership:who)」

import { execFileSync } from "node:child_process";

import { existsAt, filesUnder, forkIdAt, INTAKE_PATH, judgeFork, reassignMiddleTier, resolveForkContext, treeSnapshot } from "./check.mjs";
import { matchIntake, parseIntake } from "./intake.mjs";
import { judge } from "./judge.mjs";
import { unitName } from "./unitNames.mjs";

/** 受け口の kind → 書き換えてよい範囲(既存のファイル) */
const EDIT_BY_KIND = {
  edit: "受け口(edit): 書き換えてよい",
  region: "fork の区画(fork entries start … end)の中だけ",
  marker: "`fork entries below` の行より下だけ",
  append: "基準の中身を先頭に残した追記だけ",
  generated: "生成物: 生成器で作り直す(手で直さない)",
};

const showHead = (repoRoot, path) => {
  try {
    return execFileSync("git", ["show", `HEAD:${path}`], { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return null;
  }
};

/** 丸ごと置き換え <名前>.replace の候補(<名前>.default の隣も同じ名前)。.replace / .override 自身は null */
export function replaceCandidate(path) {
  const match = /\.(tsx?)$/.exec(path);
  if (!match) return null;
  const unit = unitName(path);
  if (/\.(replace|override)$/.test(unit)) return null;
  return `${unit.replace(/\.default$/, "")}.replace.${match[1]}`;
}

/** 一部の上書き <対象>.override.ts の候補(cron のフォルダは上書きできるのが task.ts だけなので、どのファイルも task.override.ts)。.override 自身は null */
export function overrideCandidate(path) {
  const cron = /^(src\/app\/api\/cron\/[^/]+)\/[^/]+$/.exec(path);
  if (cron) return /\.override\.tsx?$/.test(path) ? null : `${cron[1]}/task.override.ts`;
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  const stem = path.slice(0, slash + 1 + dot);
  if (/\.(override|replace)$/.test(stem)) return null;
  return `${stem}.override.ts`;
}

/**
 * 1 パスの答え(git に触れない)。
 * @param {{
 *   path: string,
 *   inBase: boolean, inHead: boolean, inTier1: boolean,
 *   middleName: string | null,           // 基準にあり Tier1 の版に無いファイルを足した Tier の名前
 *   intake: object[],                    // 基準の受け口の一覧(parseIntake().rules)
 *   entry: object | null,                // 基準との差分の判定(judgeFork の entries の 1 件、差分が無ければ null)
 *   permit: object | null,               // 自分の一時許可の行(parsePermits の 1 件)
 *   judgeAdd: (path: string) => { reason: string, verdict: string },  // そのパスを足したときの判定(中間 Tier の付け替え込み)
 * }} input
 */
export function describePath({ path, inBase, inHead, inTier1, middleName, intake, entry, permit, judgeAdd }) {
  const rule = matchIntake(intake, path);
  const tier = !inBase ? (inHead ? "fork" : "missing") : inTier1 ? "tier1" : "middle";
  const owner = { kind: rule?.kind === "generated" && tier !== "missing" ? "generated" : tier, tier, ...(tier === "middle" ? { forkId: middleName } : {}) };

  const allowed = [];
  const blocked = [];
  if (tier === "missing") {
    const added = judgeAdd(path);
    if (added.verdict === "ok") allowed.push({ action: "add", how: added.reason === "middle-tier" ? "足してよい(中間 Tier の物の中)" : "足してよい" });
    else blocked.push({ action: "add", reason: added.reason });
  } else if (tier === "fork") {
    allowed.push({ action: "edit", how: "fork が足したファイル: 書き換え・削除・rename してよい" });
  } else if (tier === "middle") {
    allowed.push({ action: "edit", how: `中間 Tier${middleName ? ` ${middleName}` : ""} の物: 書き換え・削除・rename してよい(D29)` });
  } else if (rule && EDIT_BY_KIND[rule.kind]) {
    allowed.push({ action: "edit", how: EDIT_BY_KIND[rule.kind] });
  } else {
    blocked.push({ action: "edit", reason: rule?.kind === "debt" ? "debt" : "outside-intake" });
  }

  // 丸ごと置き換え・一部の上書き: 受け口の一覧にその口を名指しする行(glob に .replace / override を含む)があり、
  // 足したときの判定が合格のときだけ(src/config/** のような広い edit の行で上書きの口があるとは言わない)
  if (tier !== "missing" && tier !== "fork") {
    const replace = replaceCandidate(path);
    const replaceRule = replace ? matchIntake(intake, replace) : null;
    if (replaceRule?.kind === "add" && replaceRule.glob.includes(".replace") && judgeAdd(replace).verdict === "ok") {
      allowed.push({ action: "replace", how: `${replace} を足し、1 行スイッチを向け替える`, path: replace });
    }
    const override = overrideCandidate(path);
    const overrideRule = override ? matchIntake(intake, override) : null;
    if ((overrideRule?.kind === "edit" || overrideRule?.kind === "add") && overrideRule.glob.includes("override") && judgeAdd(override).verdict === "ok") {
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
  return { path, owner, allowed, blocked, evidence };
}

/** 引数のパスを repo 相対のファイルに広げる(フォルダ = その下のファイル、HEAD ∪ 基準) */
export function expandPaths(repoRoot, paths, revs) {
  const out = [];
  const seen = new Set();
  const push = (path) => {
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
 * @param {{ parent?: string, branch?: string, fetch?: boolean }} [options]
 * @returns {{ status: "tier1" | "ok", ownerId: string, results: object[] } & object | { status: "unverified", reason: string }}
 */
export function whoOwns(repoRoot, paths, options = {}) {
  const context = resolveForkContext(repoRoot, options);
  if (context.status === "unverified") return context;

  if (context.status === "tier1") {
    // Tier1: このリポは全部自分の物。答えは「直接の fork から見たら」(HEAD を基準に見立てる)
    const intake = parseIntake(showHead(repoRoot, INTAKE_PATH) ?? "");
    if (intake.errors.length > 0) return { status: "unverified", reason: `${INTAKE_PATH} に書式の誤りがある`, ownerId: context.ownerId, errors: intake.errors };
    const snapshot = treeSnapshot(repoRoot, "HEAD");
    const files = new Set(snapshot.files);
    const judgeAdd = addJudge(snapshot, intake.rules, files);
    const results = expandPaths(repoRoot, paths, ["HEAD"]).map((path) =>
      describePath({ path, inBase: files.has(path), inHead: files.has(path), inTier1: files.has(path), middleName: null, intake: intake.rules, entry: null, permit: null, judgeAdd }),
    );
    return { status: "tier1", ownerId: context.ownerId, results };
  }

  const { entries, permits, snapshot } = judgeFork(repoRoot, context);
  const baseFiles = new Set(snapshot.files);
  const judgeAdd = addJudge(snapshot, context.intake, context.tier1Files);
  const chain = [...context.tier1.chain].reverse(); // Tier1 に近い版から
  const middleNameOf = (path) => chain.find((step) => existsAt(repoRoot, step.sha, path))?.name ?? forkIdAt(repoRoot, context.base);

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
    });
  });
  const { ownerId, remote, branch, base, tier1 } = context;
  return { status: "ok", ownerId, remote, branch, base, tier1, results };
}

/** そのパスを足したときの判定(judge + 中間 Tier の付け替え。ownership:check と同じ) */
function addJudge(snapshot, intake, tier1Files) {
  return (path) => {
    const { entries } = judge({
      changes: [{ status: "A", path }],
      baseText: snapshot.read,
      headText: () => null,
      baseLibs: snapshot.libs,
      baseHasCore: snapshot.hasCore,
      baseHasGate: snapshot.hasGate,
      intake,
      places: snapshot.places,
      baseUnits: snapshot.units,
    });
    reassignMiddleTier(entries, tier1Files);
    return entries[0];
  };
}
