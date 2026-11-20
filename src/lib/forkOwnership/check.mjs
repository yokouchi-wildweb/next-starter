// 検査の本体: git から基準と差分・中身を取り、judge と checkPermits に渡す。対話なし(CI でも動く)
// 表示と終了コードは cli.mjs。仕様: ./README.md「Usage」「鮮度」

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { forkIdOfTexts, PROJECT_RULES_FILE, readForkIdentity, REPO_JSON_FILE } from "./forkIds.mjs";
import { matchIntake, parseIntake } from "./intake.mjs";
import { judge } from "./judge.mjs";
import { checkLineageStructure, checkOverrides, LINEAGE_FILE, parseLineage } from "./lineage.mjs";
import { unitIndex, unitPlaces } from "./unitNames.mjs";
import { checkPermits, fingerprint, parsePermits, permitsPath } from "./permits.mjs";
import { SELF_CHECK_DEFAULT, SELF_FILES, SELF_OVERVIEW_FILE, selfProblems } from "./self.mjs";

export const INTAKE_PATH = "src/lib/forkOwnership/intake.txt";
export const PARENT_ENV = "FORK_OWNERSHIP_PARENT";

const git = (repoRoot, args, { input } = {}) =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });

const tryGit = (repoRoot, args) => {
  try {
    return git(repoRoot, args);
  } catch {
    return null;
  }
};

/** <rev>:<path> の中身。無ければ null */
const show = (repoRoot, rev, path) => tryGit(repoRoot, ["show", `${rev}:${path}`]);

const unverified = (reason, extra = {}) => ({ status: "unverified", reason, ...extra });

/** 親の remote(/flux の「FINDING THE UPSTREAM」と同じ: 指定 > 環境変数 > origin 以外が 1 つ) */
export function resolveParentRemote(repoRoot, requested) {
  const remotes = (tryGit(repoRoot, ["remote"]) ?? "").split("\n").filter(Boolean);
  const wanted = requested ?? process.env[PARENT_ENV] ?? null;
  if (wanted) return remotes.includes(wanted) ? { remote: wanted } : { error: `remote ${wanted} が無い` };
  const others = remotes.filter((name) => name !== "origin");
  if (others.length === 1) return { remote: others[0] };
  if (others.length === 0) return { error: "親の remote が無い(origin 以外の remote を足すか --parent で指定する)" };
  return { error: `親の remote が決まらない(${others.join(", ")})。--parent か ${PARENT_ENV} で指定する` };
}

export function resolveParentBranch(repoRoot, remote, requested) {
  if (requested) return requested;
  const out = tryGit(repoRoot, ["ls-remote", "--symref", remote, "HEAD"]);
  const match = out && /^ref: refs\/heads\/(\S+)\s+HEAD/m.exec(out);
  return match ? match[1] : null;
}

const NOTICE_FILE = /^\.notices\/(?:done\/)?(\d{8}-\d{6}-[^/]+)\.md$/;

/** git log の `@<sha>` 区切りの名前の行: [{ commit, line }] */
function logNames(repoRoot, args) {
  const out = [];
  let cur = null;
  for (const line of (tryGit(repoRoot, ["-c", "core.quotePath=false", ...args]) ?? "").split("\n")) {
    if (line.startsWith("@")) cur = line.slice(1);
    else if (line && cur) out.push({ commit: cur, line });
  }
  return out;
}

/**
 * ref の履歴で .notices/ に足された notice: id → { commit, path }(最初に足した commit。merge で足した物も拾い、改名の前の名前は除く)。
 * 出荷済みの一覧の正 = 履歴(索引は持たない、D350)。求め方は .claude/skills/flux/incoming.mjs の addCommits と同じ
 * (src/lib は .claude を import しないので、数行をここに置く)
 */
function historyNotices(repoRoot, ref) {
  const out = new Map();
  for (const { commit, line } of logNames(repoRoot, ["log", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", ref, "--", ".notices/"])) {
    const id = NOTICE_FILE.exec(line)?.[1];
    if (id) out.set(id, { commit, path: line }); // 新しい順 → 最後 = 最も古い
  }
  for (const { commit, line } of logNames(repoRoot, ["log", "-m", "--merges", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", ref, "--", ".notices/"])) {
    const id = NOTICE_FILE.exec(line)?.[1];
    if (id && (!out.has(id) || out.get(id).merge)) out.set(id, { commit, path: line, merge: true });
  }
  for (const { line } of logNames(repoRoot, ["log", "-M", "--diff-filter=R", "--name-status", "--format=@%H", ref, "--", ".notices/"])) {
    const [status, from, to] = line.split("\t");
    const a = NOTICE_FILE.exec(from ?? "")?.[1];
    const b = NOTICE_FILE.exec(to ?? "")?.[1];
    if (status?.startsWith("R") && a && b && a !== b) out.delete(a);
  }
  return out;
}

/** ref で出荷済みの notice の id = その版の履歴で足された本文 ∪ 木の本文(本文は区間が閉じれば消えてよい) */
function shippedIds(repoRoot, ref) {
  const ids = new Set(historyNotices(repoRoot, ref).keys());
  for (const path of (tryGit(repoRoot, ["-c", "core.quotePath=false", "ls-tree", "-r", "--name-only", ref, ".notices/"]) ?? "").split("\n")) {
    const id = NOTICE_FILE.exec(path)?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

/** 本文の最後の版: 木に有れば ref の版、消えていれば消す前の版、どちらでもなければ足した版。id → 中身 */
function lastBodies(repoRoot, ref) {
  const inTree = new Map();
  for (const path of (tryGit(repoRoot, ["-c", "core.quotePath=false", "ls-tree", "-r", "--name-only", ref, ".notices/"]) ?? "").split("\n")) {
    const id = NOTICE_FILE.exec(path)?.[1];
    if (id) inTree.set(id, `${ref}:${path}`);
  }
  const deleted = new Map();
  for (const { commit, line } of logNames(repoRoot, ["log", "--no-renames", "--diff-filter=D", "--name-only", "--format=@%H", ref, "--", ".notices/"])) {
    const id = NOTICE_FILE.exec(line)?.[1];
    if (id && !deleted.has(id)) deleted.set(id, `${commit}^:${line}`); // 新しい順 → 最初 = 最後に消した
  }
  const specs = new Map(inTree);
  for (const [id, add] of historyNotices(repoRoot, ref)) if (!specs.has(id)) specs.set(id, deleted.get(id) ?? `${add.commit}:${add.path}`);
  const out = new Map();
  if (specs.size === 0) return out;
  const list = [...specs];
  const buf = execFileSync("git", ["cat-file", "--batch"], { cwd: repoRoot, input: list.map(([, spec]) => spec).join("\n") + "\n", maxBuffer: 512 * 1024 * 1024 });
  let at = 0;
  for (const [id] of list) {
    const nl = buf.indexOf(10, at);
    const head = buf.subarray(at, nl).toString("utf8");
    if (head.endsWith(" missing")) {
      at = nl + 1;
      continue;
    }
    const size = Number(head.split(" ")[2]);
    out.set(id, buf.subarray(nl + 1, nl + 1 + size).toString("utf8"));
    at = nl + 1 + size + 1;
  }
  return out;
}

/**
 * 取り込み済み(基準にある)なのに自分の台帳に記録の無い notice(L1.7)。
 * fork を作った時点のツリーにあった notice は継承済みとして除く(/flux と同じ求め方)。
 * 基準・成立点とも「履歴で足された本文 ∪ 木の本文」で読む(本文が消えても結果が変わらない)
 */
function unrecordedNotices(repoRoot, base, parentRef, ownerId) {
  const baseIds = [...shippedIds(repoRoot, base)];
  const own = (tryGit(repoRoot, ["rev-list", "--reverse", "HEAD", `^${parentRef}`]) ?? "").split("\n").filter(Boolean);
  if (own.length === 0) return [];
  const hasParent = tryGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${own[0]}^`]) !== null;
  const forkPoint = hasParent ? `${own[0]}^` : own[0];
  const inherited = shippedIds(repoRoot, forkPoint);
  const ledger = show(repoRoot, "HEAD", `.notices/applied/${ownerId}.md`) ?? "";
  const recorded = new Set([...ledger.matchAll(/^- id:(\S+)/gm)].map((match) => match[1]));
  return baseIds.filter((id) => !inherited.has(id) && !recorded.has(id)).sort();
}

const splitIds = (value) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "-");

/**
 * 基準(取り込み済み)の notice の resolves: に書かれた指令 id(上流が解決した下流の依頼)。
 * 履歴で足された notice の本文の最後の版で読む(本文が消えても消す前の版が残るので失効は変わらない)
 */
function resolvedOrders(repoRoot, base) {
  const ids = new Set();
  for (const text of lastBodies(repoRoot, base).values()) {
    const match = /^resolves:\s*(.+)$/m.exec(text);
    if (!match) continue;
    for (const id of splitIds(match[1])) ids.add(id);
  }
  return ids;
}

/** `git diff --name-status -M -z` → [{ status, path, from? }] */
function parseNameStatus(out) {
  const parts = out.split("\0").filter((part) => part !== "");
  const changes = [];
  for (let i = 0; i < parts.length; ) {
    const status = parts[i];
    if (status[0] === "R" || status[0] === "C") {
      changes.push({ status, from: parts[i + 1], path: parts[i + 2] });
      i += 3;
    } else {
      changes.push({ status, path: parts[i + 1] });
      i += 2;
    }
  }
  return changes;
}

/** 台帳の本文の最後の upstream:<sha>(取り込んだ上流の版、/flux が区間ごとの行に書く)。無ければ null */
export function lastUpstreamSha(ledgerText) {
  const shas = [...(ledgerText ?? "").matchAll(/^- id:.*\|\s*upstream:([0-9a-f]{7,40})\b/gm)].map((match) => match[1]);
  return shas.at(-1) ?? null;
}

/** 台帳の本文の picked:<sha>(親の緊急修正を cherry-pick した元の commit)を書かれた順に */
export function pickedShas(ledgerText) {
  return [...(ledgerText ?? "").matchAll(/^- id:.*\|\s*picked:([0-9a-f]{7,40})\b/gm)].map((match) => match[1]);
}

/** 3 方向の合成(git merge-file)。衝突・バイナリは null */
function mergeText(repoRoot, current, old, next) {
  const dir = mkdtempSync(join(tmpdir(), "fork-ownership-pick-"));
  try {
    const paths = ["current", "old", "next"].map((name) => join(dir, name));
    [current, old, next].forEach((text, index) => writeFileSync(paths[index], text));
    return tryGit(repoRoot, ["merge-file", "-p", ...paths]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 基準に pick だけを順に当てた、そのパスの中身(無いファイルは null)。
 * @returns {{ touched: boolean, text: string | null } | null} 当てられない(衝突)なら null
 */
function textAfterPicks(repoRoot, picks, path, baseContent) {
  let text = baseContent;
  let touched = false;
  for (const sha of picks) {
    const old = show(repoRoot, `${sha}^`, path);
    const next = show(repoRoot, sha, path);
    if (old === next) continue;
    touched = true;
    if (next === null) text = null;
    else if (old === null) {
      if (text !== null && text !== next) return null;
      text = next;
    } else {
      if (text === null) return null;
      text = mergeText(repoRoot, text, old, next);
      if (text === null) return null;
    }
  }
  return { touched, text };
}

/** 台帳をたどる深さの上限(循環・壊れた台帳で止まらないように) */
export const TIER1_WALK_LIMIT = 10;

/**
 * Tier1 の版を決める(D29 の読み方 = 多段ティア D34): 自分の台帳の最後の upstream: の版から始め、
 * その版に .notices/applied/ があれば、その版のリポの名前(その版の project.md の fork_id:)の台帳の最後の upstream: へ …
 * と .notices/applied/ を持たない版(= Tier1)に着くまでたどる。段数に依らない。
 * 途中で欠ける(upstream: が無い・sha が無い・その版に fork_id: / 台帳が無い)・循環・深さの上限 → error(exit 2)
 * @returns {{ sha: string, chain: { sha: string, name: string }[] } | { error: string }}
 */
function resolveTier1Version(repoRoot, ownerId) {
  const chain = [];
  const seen = new Set();
  let ledgerPath = `.notices/applied/${ownerId}.md`;
  let ledgerText = show(repoRoot, "HEAD", ledgerPath);
  let from = "HEAD";
  for (let depth = 0; depth < TIER1_WALK_LIMIT; depth += 1) {
    const sha = lastUpstreamSha(ledgerText);
    if (!sha) {
      return {
        error: `${from} の ${ledgerPath} に upstream:<sha> の行が無い(Tier1 の版が決まらない。/flux が区間の台帳の行に取り込んだ上流の版を書く)`,
      };
    }
    if (tryGit(repoRoot, ["cat-file", "-e", `${sha}^{commit}`]) === null) {
      return { error: `${from} の ${ledgerPath} の upstream:${sha} が履歴に無い(squash・rebase で辿れない。取得し直すか /flux で記録し直す)` };
    }
    if (seen.has(sha)) return { error: `台帳の upstream: が循環している(${sha.slice(0, 10)})` };
    seen.add(sha);
    const applied = tryGit(repoRoot, ["ls-tree", "--name-only", sha, ".notices/applied/"]) ?? "";
    if (applied.trim() === "") return { sha, chain };
    const name = forkIdAt(repoRoot, sha);
    if (!name) return { error: `${sha.slice(0, 10)} の版(中間 Tier)に ${REPO_JSON_FILE} の repo_id(古い形は ${PROJECT_RULES_FILE} の fork_id:)が無い(その Tier が名前の宣言を含む版を出していない)` };
    chain.push({ sha, name });
    from = sha.slice(0, 10);
    ledgerPath = `.notices/applied/${name}.md`;
    ledgerText = show(repoRoot, sha, ledgerPath);
    if (ledgerText === null) return { error: `${from} の版(${name})に ${ledgerPath} が無い(台帳の名前を repo_id にそろえる)` };
  }
  return { error: `台帳を ${TIER1_WALK_LIMIT} 段たどっても Tier1 の版(.notices/applied/ の無い版)に着かない` };
}

/**
 * 直接の親との基準(merge-base)を求める(runCheck と forkAddedFiles の共通の入口)
 * @returns {{ ownerId: string, remote: string, branch: string, base: string, parentRef: string } | { status: "unverified", reason: string }}
 */
function resolveParentBase(repoRoot, ownerId, { parent, branch, fetch }) {
  if (tryGit(repoRoot, ["rev-parse", "--is-shallow-repository"])?.trim() === "true") {
    return unverified("shallow clone では基準を求められない(git fetch --unshallow)", { ownerId });
  }
  const parentRemote = resolveParentRemote(repoRoot, parent);
  if (parentRemote.error) return unverified(parentRemote.error, { ownerId });
  const remote = parentRemote.remote;
  const parentBranch = resolveParentBranch(repoRoot, remote, branch);
  if (!parentBranch) return unverified(`${remote} の既定のブランチが分からない(取得できないか --branch で指定する)`, { ownerId, remote });
  if (fetch && tryGit(repoRoot, ["fetch", "--quiet", remote, parentBranch]) === null) {
    return unverified(`${remote} を取得できない`, { ownerId, remote, branch: parentBranch });
  }
  const parentRef = `${remote}/${parentBranch}`;
  const base = tryGit(repoRoot, ["merge-base", "HEAD", parentRef])?.trim();
  if (!base) return unverified(`${parentRef} との merge-base が無い`, { ownerId, remote, branch: parentBranch });
  return { ownerId, remote, branch: parentBranch, base, parentRef };
}

/**
 * fork が足したファイルの一覧(「fork の物か」の見分け。名前の印では見ない、D137)。
 * Tier1 は git に触れず空の一覧を返す(全部が上流の物)。基準が求められなければ unverified(合格にしない)
 * @param {string} repoRoot
 * @param {{ parent?: string, branch?: string, fetch?: boolean }} [options] fetch: false = 取得済みの ref で判定する(テストの中など)
 * @returns {{ status: "tier1", added: Set<string> } | { status: "ok", base: string, parentRef: string, added: Set<string> } | { status: "unverified", reason: string }}
 *   parentRef = 親の remote のブランチ(<remote>/<branch>、取得済みの ref)
 */
export function forkAddedFiles(repoRoot, { parent, branch, fetch = true } = {}) {
  const identity = readForkIdentity(repoRoot);
  if (identity.errors.length > 0) return unverified(`fork の名前の宣言に問題がある: ${identity.errors.join(" / ")}`, { ownerId: identity.own });
  // 下流の有無の宣言の誤りは所有の検査だけが止める(errors と別の欄。ビルドは止めない)
  if (identity.downstreamError) return unverified(`下流の有無の宣言に問題がある: ${identity.downstreamError}`, { ownerId: identity.own });
  if (identity.isTier1) return { status: "tier1", added: new Set() };
  const where = resolveParentBase(repoRoot, identity.own, { parent, branch, fetch });
  if (where.status === "unverified") return where;
  const added = (tryGit(repoRoot, ["diff", "--name-only", "--no-renames", "--diff-filter=A", "-z", where.base, "HEAD"]) ?? "").split("\0").filter(Boolean);
  return { status: "ok", base: where.base, parentRef: where.parentRef, added: new Set(added) };
}

/**
 * 版 rev のツリーを judge に渡す形にする(中身の読み手・ファイルの一覧・単位名の場所・lib・core の有無)。
 * runCheck は基準(merge-base)で、pnpm workflow ownership who は Tier1 で HEAD を基準に見立てて使う
 * @param {string} repoRoot
 * @param {string} rev
 */
export function treeSnapshot(repoRoot, rev) {
  const cache = new Map();
  const read = (path) => {
    if (!cache.has(path)) cache.set(path, show(repoRoot, rev, path));
    return cache.get(path);
  };
  const files = (tryGit(repoRoot, ["ls-tree", "-r", "--name-only", rev]) ?? "").split("\n").filter(Boolean);
  const libs = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", rev, "src/lib/"]) ?? "")
    .split("\n")
    .filter(Boolean)
    .map((path) => path.replace(/^src\/lib\//, ""));
  const hasCore = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", rev, "src/features/core"]) ?? "").trim() !== "";
  const hasGate = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", rev, "src/featureGate"]) ?? "").trim() !== "";
  const hasRulesCore = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", rev, ".claude/rules/core"]) ?? "").trim() !== "";
  // 単位名の同名・自分の項目への override(D137 の印の代わり): 基準のファイルの単位と照らす
  return { rev, read, files, libs, hasCore, hasGate, hasRulesCore, places: unitPlaces(files, read), units: unitIndex(files) };
}

/**
 * fork の検査の前提をそろえる(runCheck と pnpm workflow ownership who の共通の入口)。順に: 名前の宣言 → Tier1 なら打ち切り →
 * 直接の親との基準 → 基準の受け口の一覧 → 鮮度(台帳に無い notice)→ Tier1 の版。どこかで欠ければ unverified(exit 2)
 * @param {string} repoRoot
 * @param {{ parent?: string, branch?: string, fetch?: boolean }} [options]
 * @returns {{ status: "tier1", ownerId: string }
 *   | { status: "unverified", reason: string }
 *   | { status: "ok", ownerId: string, remote: string, branch: string, base: string, downstream: "yes" | "none" | null, parentRef: string,
 *       intake: object[], tier1: { sha: string, chain: { sha: string, name: string }[] }, tier1Files: Set<string> }}
 */
export function resolveForkContext(repoRoot, { parent, branch, fetch = true } = {}) {
  // 自分の名前と Tier1 の判定は forkIds.mjs だけが読む(project.md の fork_id:、CATALOG.md の先頭の節。origin は読まない、D27)
  const identity = readForkIdentity(repoRoot);
  const ownerId = identity.own;
  if (identity.errors.length > 0) {
    return unverified(`fork の名前の宣言に問題がある: ${identity.errors.join(" / ")}`, { ownerId });
  }
  if (identity.isTier1) return { status: "tier1", ownerId };

  const resolved = resolveParentBase(repoRoot, ownerId, { parent, branch, fetch });
  if (resolved.status === "unverified") return resolved;
  const { remote, branch: parentBranch, base, parentRef } = resolved;
  const where = { ownerId, remote, branch: parentBranch, base };

  const intakeText = show(repoRoot, base, INTAKE_PATH);
  if (intakeText === null) return unverified(`基準に ${INTAKE_PATH} が無い(この検査を含む版をまだ取り込んでいない)`, where);
  const intake = parseIntake(intakeText);
  if (intake.errors.length > 0) return unverified(`基準の ${INTAKE_PATH} に書式の誤りがある`, { ...where, errors: intake.errors });

  const unrecorded = unrecordedNotices(repoRoot, base, parentRef, ownerId);
  if (unrecorded.length > 0) {
    return unverified("取り込み済みの notice が台帳に無い(/flux で記録してから検査する)", { ...where, unrecorded });
  }

  // 多段(D29): Tier1 の版にあるファイルだけ厳密、無いファイル(中間 Tier 以下の物)は合格にして参考の一覧へ
  const tier1 = resolveTier1Version(repoRoot, ownerId);
  if (tier1.error) return unverified(tier1.error, where);
  const tier1Files = new Set((tryGit(repoRoot, ["ls-tree", "-r", "--name-only", tier1.sha]) ?? "").split("\n").filter(Boolean));

  return { status: "ok", ...where, downstream: identity.downstream, parentRef, intake: intake.rules, tier1: { sha: tier1.sha, chain: tier1.chain }, tier1Files };
}

/**
 * Tier1 の版に無いファイルの違反を `middle-tier`(合格・参考)に付け替える(D29)。entries を書き換え、付け替えた分を返す
 * @param {{ status: string, path: string, from?: string, reason: string, verdict: string }[]} entries judge の結果
 * @param {Set<string>} tier1Files
 */
const SERVICE_PREFIX = ".claude/rules/service/";

export function reassignMiddleTier(entries, tier1Files) {
  const middleTier = [];
  for (const entry of entries) {
    if (entry.verdict !== "violation") continue;
    // 同名・自分の項目への override・親の既定(*.default.*)の追加と書き換えは持ち主によらず止める(中間 Tier の物にしない。中間 Tier の既定も親の物、D169)
    if (entry.reason === "unit-clash" || entry.reason === "override-own" || entry.reason === "default-add" || entry.reason === "default-edit" || entry.reason === "frame-plain") continue;
    const target = entry.status === "R" ? entry.from : entry.path;
    // 祖先の lib への追加: その lib が Tier1 の版にあれば Tier1 の物(厳密)、無ければ中間 Tier の lib
    const lib = entry.reason === "ancestor-lib-add" ? /^src\/lib\/([^/]+)\//.exec(target)?.[1] : null;
    // 業務の全体像 .claude/rules/service/ は中間 Tier が足した物も下流で直せない(D117: このフォルダだけ中間 Tier の付け替えをしない)
    if (target.startsWith(SERVICE_PREFIX)) continue;
    // core・門番・決まりの core への追加: どれも Tier1 の物(足したファイルは Tier1 の版に無いが、中間 Tier の物にしない)
    const tier1Prefix = { "core-add": "src/features/core/", "gate-add": "src/featureGate/", "rules-core-add": ".claude/rules/core/" }[entry.reason];
    const tier1Owned =
      tier1Prefix
        ? [...tier1Files].some((file) => file.startsWith(tier1Prefix))
        : lib
          ? [...tier1Files].some((file) => file.startsWith(`src/lib/${lib}/`))
          : tier1Files.has(target);
    if (tier1Owned) continue;
    middleTier.push({ path: entry.path, from: entry.from, was: entry.reason });
    entry.reason = "middle-tier";
    entry.verdict = "ok";
  }
  return middleTier;
}

/**
 * 基準との差分の全件を判定する(judge → 中間 Tier の付け替え → pick → 一時許可 → 許可の下書き)。context = resolveForkContext の ok
 * @returns {{ entries: object[], leftovers: object[], middleTier: object[], permitFile: string, permitErrors: object[], snapshot: object, headText: (path: string) => string | null }}
 */
export function judgeFork(repoRoot, context) {
  const { ownerId, base, intake, tier1Files } = context;
  const changes = parseNameStatus(git(repoRoot, ["diff", "--name-status", "-M", "-z", base, "HEAD"]));
  const snapshot = treeSnapshot(repoRoot, base);
  const baseText = snapshot.read;
  const headCache = new Map();
  const headText = (path) => {
    if (!headCache.has(path)) headCache.set(path, show(repoRoot, "HEAD", path));
    return headCache.get(path);
  };

  const judged = judge({
    changes,
    baseText,
    headText,
    baseLibs: snapshot.libs,
    baseHasCore: snapshot.hasCore,
    baseHasGate: snapshot.hasGate,
    baseHasRulesCore: snapshot.hasRulesCore,
    intake,
    places: snapshot.places,
    baseUnits: snapshot.units,
  });
  const middleTier = reassignMiddleTier(judged.entries, tier1Files);
  // 親の緊急修正の pick(台帳の picked:)。基準 + pick と同じ中身、または pick の時点の上流の版と同じ中身なら違反にしない
  // (fork が更に変えた分は違反のまま)。
  // 既に基準に入った pick は差分に出ないので外す
  const picks = pickedShas(headText(`.notices/applied/${ownerId}.md`)).filter(
    (sha) => tryGit(repoRoot, ["cat-file", "-e", `${sha}^^{commit}`]) !== null && tryGit(repoRoot, ["merge-base", "--is-ancestor", sha, base]) === null,
  );
  for (const entry of judged.entries) {
    if (entry.verdict !== "violation" || picks.length === 0) continue;
    const targets = entry.from ? [entry.from, entry.path] : [entry.path];
    // 基準 + pick と同じ中身、または pick がそのファイルを変えていて、その pick の時点の上流の版とファイルごと同じ中身
    // (緊急修正の衝突で fork が変えていない上流のファイルを上流の版に置き換えた形: pnpm workflow notices hotfixApply)
    const onlyPicked = targets.every((path) => {
      const head = headText(path);
      const after = textAfterPicks(repoRoot, picks, path, baseText(path));
      if (after?.touched && after.text === head) return true;
      return picks.some((sha) => {
        const next = show(repoRoot, sha, path);
        return next !== null && next !== show(repoRoot, `${sha}^`, path) && next === head;
      });
    });
    if (!onlyPicked) continue;
    entry.reason = "picked";
    entry.verdict = "ok";
  }
  const permitFile = permitsPath(ownerId);
  const permitParse = parsePermits(headText(permitFile) ?? "");
  const { entries, leftovers } = checkPermits({
    entries: judged.entries,
    permits: permitParse.permits,
    baseText,
    headText,
    intake,
    resolvedUpreqs: resolvedOrders(repoRoot, base),
  });

  // 許可の行の下書き(違反だけ。今の指紋で書く)
  for (const entry of entries) {
    if (entry.verdict !== "violation") continue;
    const target = entry.status === "R" ? entry.from : entry.path;
    const kind = matchIntake(intake, target)?.kind ?? null;
    const baseFp = entry.fingerprints?.base ?? fingerprint(baseText(target), kind);
    const headFp = entry.fingerprints?.head ?? (entry.status === "D" || entry.status === "R" ? "-" : fingerprint(headText(target), kind));
    entry.permitDraft = `${target} upreq:<依頼の番号> base:${baseFp} head:${headFp}  # <理由>`;
  }

  return { entries, leftovers, middleTier, permitFile, permitErrors: permitParse.errors, permits: permitParse.permits, snapshot, headText };
}

/**
 * 型 5 self の検査の入力を git から集めて判定する(self.mjs)。Tier1 は自分の受け口の一覧とファイルの有無だけ
 * 「取り込みで親の版が入った」の merge = 基準 base を 2 番目以降の親に持つ、HEAD から見て最新の merge
 * @returns {{ enabled: true, problems: { kind: string, path: string, message: string }[], unverified: string[] }}
 */
export function collectSelf(repoRoot, { isTier1, base = null, parentRef = null }) {
  const head = Object.fromEntries(SELF_FILES.map((path) => [path, show(repoRoot, "HEAD", path)]));
  const intakeText = show(repoRoot, isTier1 ? "HEAD" : base, INTAKE_PATH);
  const selfRows = intakeText === null ? null : parseIntake(intakeText).rules.filter((rule) => rule.kind === "self").map((rule) => rule.glob);
  if (isTier1) return { enabled: true, ...selfProblems({ isTier1, selfRows, head, merge: null, parentNow: null }) };

  const lines = (tryGit(repoRoot, ["rev-list", "--merges", "--parents", "--ancestry-path", `${base}..HEAD`]) ?? "").split("\n").filter(Boolean);
  const mergeLine = lines.map((line) => line.split(" ")).find(([, , ...others]) => others.includes(base));
  let merge = { found: false, before: {}, base: {} };
  if (mergeLine) {
    const [, firstParent] = mergeLine;
    merge = {
      found: true,
      before: Object.fromEntries(SELF_FILES.map((path) => [path, show(repoRoot, firstParent, path)])),
      base: Object.fromEntries(SELF_FILES.map((path) => [path, show(repoRoot, base, path)])),
    };
  }
  const parentNow = show(repoRoot, parentRef, SELF_OVERVIEW_FILE);
  return { enabled: true, ...selfProblems({ isTier1, selfRows, head, merge, parentNow }) };
}

/**
 * @param {string} repoRoot
 * @param {{ parent?: string, branch?: string, fetch?: boolean, self?: boolean }} [options] fetch: false はテスト用(取得済みの ref で判定する)。
 *   self: 型 5 self の検査を走らせるか(省略 = SELF_CHECK_DEFAULT = 入)
 * @returns {object} status: tier1 | unverified | pass | fail
 */
export function runCheck(repoRoot, options = {}) {
  const selfEnabled = options.self ?? SELF_CHECK_DEFAULT;
  const context = resolveForkContext(repoRoot, options);
  if (context.status === "unverified") return context;
  // 下流の有無の誤りで止めるのは pnpm workflow ownership check(と lineage の検査)だけ。pnpm workflow ownership who とビルドは止めない(L1.2)
  const { downstreamError } = readForkIdentity(repoRoot);
  if (downstreamError) return unverified(`下流の有無の宣言に問題がある: ${downstreamError}`, { ownerId: context.ownerId });
  if (context.status === "tier1") {
    // Tier1 は検査の対象外。upstream の負債の行の数だけ返す(D29: 件数を Tier1 のコマンドと /inbox に出す)
    const own = parseIntake(show(repoRoot, "HEAD", INTAKE_PATH) ?? "");
    const self = selfEnabled ? collectSelf(repoRoot, { isTier1: true }) : { enabled: false };
    return { status: "tier1", ownerId: context.ownerId, debt: own.rules.filter((rule) => rule.kind === "debt").map((rule) => rule.glob), self };
  }
  const { ownerId, remote, branch, base, tier1, downstream } = context;

  const { entries, leftovers, middleTier, permitFile, permitErrors, headText } = judgeFork(repoRoot, context);

  const counts = {};
  for (const entry of entries) {
    const key = entry.verdict === "permitted" ? "permitted" : entry.reason;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  for (const leftover of leftovers) counts[`permit-${leftover.reason}`] = (counts[`permit-${leftover.reason}`] ?? 0) + 1;

  // 中間層の規則(lineage.md)の並び・鍵・打ち消し。祖先の部分が基準どおりかは append の判定が見る。
  // chain は直接の親から上へ積むので、古い順は逆。lineage.md の無い fork(この版を取り込む前)は検査しない
  const lineageText = headText(LINEAGE_FILE);
  const lineage = { checked: lineageText !== null, failures: [], warnings: [] };
  if (lineageText !== null) {
    const parsed = parseLineage(lineageText);
    const ancestorsOldestFirst = tier1.chain.map((step) => step.name).reverse();
    lineage.failures.push(...checkLineageStructure({ parsed, ancestorsOldestFirst, own: ownerId, downstream }));
    const overrides = checkOverrides({ parsed, projectText: headText(PROJECT_RULES_FILE) ?? "", own: ownerId, projectFile: PROJECT_RULES_FILE });
    lineage.failures.push(...overrides.failures);
    lineage.warnings.push(...overrides.warnings);
  }
  if (lineage.failures.length > 0) counts.lineage = lineage.failures.length;

  const self = selfEnabled ? collectSelf(repoRoot, { isTier1: false, base, parentRef: context.parentRef }) : { enabled: false };
  if (self.enabled && self.problems.length > 0) counts.self = self.problems.length;

  const violations = entries.filter((entry) => entry.verdict === "violation");
  const failed = violations.length > 0 || leftovers.length > 0 || permitErrors.length > 0 || lineage.failures.length > 0 || (self.enabled && self.problems.length > 0);
  return {
    status: failed ? "fail" : "pass",
    ownerId,
    remote,
    branch,
    base,
    tier1: { sha: tier1.sha, chain: tier1.chain },
    middleTier,
    permitFile,
    permitErrors,
    counts,
    entries,
    leftovers,
    lineage,
    self,
  };
}

/** rev のツリーにファイル(blob)としてあるか(フォルダは false) */
export const existsAt = (repoRoot, rev, path) => tryGit(repoRoot, ["cat-file", "-t", `${rev}:${path}`])?.trim() === "blob";

/** rev のツリーで dir の下にあるファイル(dir がファイルなら空) */
export const filesUnder = (repoRoot, rev, dir) =>
  (tryGit(repoRoot, ["ls-tree", "-r", "--name-only", rev, "--", `${dir.replace(/\/+$/, "")}/`]) ?? "").split("\n").filter(Boolean);

/** rev の版の名前(repo.json の repo_id を先に、無ければ古い形の project.md の fork_id:。無ければ null) */
export const forkIdAt = (repoRoot, rev) => forkIdOfTexts({ repoJson: show(repoRoot, rev, REPO_JSON_FILE), projectMd: show(repoRoot, rev, PROJECT_RULES_FILE) }).forkId ?? null;
