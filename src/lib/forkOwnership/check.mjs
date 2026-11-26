// 検査の本体: git から基準と差分・中身を取り、judge と checkPermits に渡す。対話なし(CI でも動く)
// 表示と終了コードは cli.mjs。仕様: ./README.md「Usage」「鮮度」

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { forkIdOfTexts, PROJECT_RULES_FILE, readForkIdentity, REPO_JSON_FILE } from "./forkIds.mjs";
import { matchIntake, parseIntake } from "./intake.mjs";
import { isDefaultName, judge } from "./judge.mjs";
import { checkLineageStructure, LINEAGE_FILE, parseLineage } from "./lineage.mjs";
import { unitIndex, unitPlaces } from "./unitNames.mjs";
import { checkPermits, fingerprint, parsePermits, permitsPath } from "./permits.mjs";
import { SELF_CHECK_DEFAULT, SELF_FILES, SELF_OVERVIEW_FILE, selfProblems } from "./self.mjs";

/**
 * @import { IntakeRule, LineError } from "./intake.mjs"
 * @import { OwnershipChange, OwnershipEntry } from "./judge.mjs"
 * @import { Permit, PermitLeftover } from "./permits.mjs"
 * @import { SelfProblem } from "./self.mjs"
 * @typedef {{ status: "unverified", reason: string, ownerId?: string | null, remote?: string, branch?: string, base?: string, errors?: LineError[], unrecorded?: string[] }} Unverified 未検証(exit 2)
 * @typedef {{ sha: string, chain: { sha: string, name: string }[] }} Tier1Version Tier1 の版と、そこまでたどった中間 Tier(直接の親から上へ)
 * @typedef {{
 *   status: "ok", ownerId: string, remote: string, branch: string, base: string, downstream: "yes" | "none" | null, parentRef: string,
 *   intake: IntakeRule[], tier1: Tier1Version, tier1Files: Set<string>,
 * }} ForkContext 検査の前提(resolveForkContext の ok)
 * @typedef {{ path: string, from?: string, was: string }} MiddleTierItem 中間 Tier の物に付け替えた違反(was = 元の reason)
 * @typedef {{ enabled: true, problems: SelfProblem[], asks: SelfProblem[], unverified: string[] } | { enabled: false }} SelfResult 型 5 self の検査(切 = enabled: false)
 * @typedef {{ checked: boolean, failures: string[] }} LineageResult
 * @typedef {Unverified
 *   | { status: "tier1", ownerId: string, debt: string[], self: SelfResult }
 *   | {
 *       status: "pass" | "fail", ownerId: string, remote: string, branch: string, base: string, tier1: Tier1Version, middleTier: MiddleTierItem[],
 *       permitFile: string, permitErrors: LineError[], counts: Record<string, number>, entries: OwnershipEntry[], leftovers: PermitLeftover[],
 *       lineage: LineageResult, self: SelfResult,
 *     }} CheckResult runCheck の結果
 */

export const INTAKE_PATH = "src/lib/forkOwnership/intake.txt";
export const PARENT_ENV = "FORK_OWNERSHIP_PARENT";

/**
 * @param {string} repoRoot
 * @param {string[]} args
 * @param {{ input?: string }} [options]
 * @returns {string}
 */
const git = (repoRoot, args, { input } = {}) =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });

/**
 * @param {string} repoRoot
 * @param {string[]} args
 * @returns {string | null} 失敗なら null
 */
const tryGit = (repoRoot, args) => {
  try {
    return git(repoRoot, args);
  } catch {
    return null;
  }
};

/**
 * <rev>:<path> の中身。無ければ null(rev が null でも null)
 * @param {string} repoRoot
 * @param {string | null} rev
 * @param {string} path
 * @returns {string | null}
 */
const show = (repoRoot, rev, path) => (rev === null ? null : tryGit(repoRoot, ["show", `${rev}:${path}`]));

/**
 * @param {string} reason
 * @param {Omit<Unverified, "status" | "reason">} [extra]
 * @returns {Unverified}
 */
const unverified = (reason, extra = {}) => ({ status: "unverified", reason, ...extra });

/**
 * 親の remote(/flux の「FINDING THE UPSTREAM」と同じ: 指定 > 環境変数 > origin 以外が 1 つ)
 * @param {string} repoRoot
 * @param {string | null} [requested]
 * @returns {{ remote: string, error?: undefined } | { error: string, remote?: undefined }}
 */
export function resolveParentRemote(repoRoot, requested) {
  const remotes = (tryGit(repoRoot, ["remote"]) ?? "").split("\n").filter(Boolean);
  const wanted = requested ?? process.env[PARENT_ENV] ?? null;
  if (wanted) return remotes.includes(wanted) ? { remote: wanted } : { error: `remote ${wanted} が無い` };
  const others = remotes.filter((name) => name !== "origin");
  if (others.length === 1) return { remote: others[0] };
  if (others.length === 0) return { error: "親の remote が無い(origin 以外の remote を足すか --parent で指定する)" };
  return { error: `親の remote が決まらない(${others.join(", ")})。--parent か ${PARENT_ENV} で指定する` };
}

/**
 * 親の remote の既定のブランチ(指定があればそれ)。分からなければ null
 * @param {string} repoRoot
 * @param {string} remote
 * @param {string | null} [requested]
 * @returns {string | null}
 */
export function resolveParentBranch(repoRoot, remote, requested) {
  if (requested) return requested;
  const out = tryGit(repoRoot, ["ls-remote", "--symref", remote, "HEAD"]);
  const match = out && /^ref: refs\/heads\/(\S+)\s+HEAD/m.exec(out);
  return match ? match[1] : null;
}

const NOTICE_FILE = /^\.notices\/(?:done\/)?(\d{8}-\d{6}-[^/]+)\.md$/;

/**
 * git log の `@<sha>` 区切りの名前の行: [{ commit, line }]
 * @param {string} repoRoot
 * @param {string[]} args
 */
function logNames(repoRoot, args) {
  /** @type {{ commit: string, line: string }[]} */
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
 * @param {string} repoRoot
 * @param {string} ref
 */
function historyNotices(repoRoot, ref) {
  /** @type {Map<string, { commit: string, path: string, merge?: boolean }>} */
  const out = new Map();
  for (const { commit, line } of logNames(repoRoot, ["log", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", ref, "--", ".notices/"])) {
    const id = NOTICE_FILE.exec(line)?.[1];
    if (id) out.set(id, { commit, path: line }); // 新しい順 → 最後 = 最も古い
  }
  for (const { commit, line } of logNames(repoRoot, ["log", "-m", "--merges", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", ref, "--", ".notices/"])) {
    const id = NOTICE_FILE.exec(line)?.[1];
    if (id && (!out.has(id) || out.get(id)?.merge)) out.set(id, { commit, path: line, merge: true });
  }
  for (const { line } of logNames(repoRoot, ["log", "-M", "--diff-filter=R", "--name-status", "--format=@%H", ref, "--", ".notices/"])) {
    const [status, from, to] = line.split("\t");
    const a = NOTICE_FILE.exec(from ?? "")?.[1];
    const b = NOTICE_FILE.exec(to ?? "")?.[1];
    if (status?.startsWith("R") && a && b && a !== b) out.delete(a);
  }
  return out;
}

/**
 * ref で出荷済みの notice の id = その版の履歴で足された本文 ∪ 木の本文(本文は区間が閉じれば消えてよい)
 * @param {string} repoRoot
 * @param {string} ref
 */
function shippedIds(repoRoot, ref) {
  const ids = new Set(historyNotices(repoRoot, ref).keys());
  for (const path of (tryGit(repoRoot, ["-c", "core.quotePath=false", "ls-tree", "-r", "--name-only", ref, ".notices/"]) ?? "").split("\n")) {
    const id = NOTICE_FILE.exec(path)?.[1];
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * 本文の最後の版: 木に有れば ref の版、消えていれば消す前の版、どちらでもなければ足した版。id → 中身
 * @param {string} repoRoot
 * @param {string} ref
 * @returns {Map<string, string>}
 */
function lastBodies(repoRoot, ref) {
  /** @type {Map<string, string>} */
  const inTree = new Map();
  for (const path of (tryGit(repoRoot, ["-c", "core.quotePath=false", "ls-tree", "-r", "--name-only", ref, ".notices/"]) ?? "").split("\n")) {
    const id = NOTICE_FILE.exec(path)?.[1];
    if (id) inTree.set(id, `${ref}:${path}`);
  }
  /** @type {Map<string, string>} */
  const deleted = new Map();
  for (const { commit, line } of logNames(repoRoot, ["log", "--no-renames", "--diff-filter=D", "--name-only", "--format=@%H", ref, "--", ".notices/"])) {
    const id = NOTICE_FILE.exec(line)?.[1];
    if (id && !deleted.has(id)) deleted.set(id, `${commit}^:${line}`); // 新しい順 → 最初 = 最後に消した
  }
  const specs = new Map(inTree);
  for (const [id, add] of historyNotices(repoRoot, ref)) if (!specs.has(id)) specs.set(id, deleted.get(id) ?? `${add.commit}:${add.path}`);
  /** @type {Map<string, string>} */
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
 * @param {string} repoRoot
 * @param {string} base
 * @param {string} parentRef
 * @param {string} ownerId
 * @returns {string[]}
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

const splitIds = (/** @type {string} */ value) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "-");

/**
 * 基準(取り込み済み)の notice の resolves: に書かれた指令 id(上流が解決した下流の依頼)。
 * 履歴で足された notice の本文の最後の版で読む(本文が消えても消す前の版が残るので失効は変わらない)
 * @param {string} repoRoot
 * @param {string} base
 */
function resolvedOrders(repoRoot, base) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const text of lastBodies(repoRoot, base).values()) {
    const match = /^resolves:\s*(.+)$/m.exec(text);
    if (!match) continue;
    for (const id of splitIds(match[1])) ids.add(id);
  }
  return ids;
}

/**
 * `git diff --name-status -M -z` → [{ status, path, from? }]
 * @param {string} out
 * @returns {OwnershipChange[]}
 */
function parseNameStatus(out) {
  const parts = out.split("\0").filter((part) => part !== "");
  /** @type {OwnershipChange[]} */
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

/**
 * 台帳の本文の最後の upstream:<sha>(取り込んだ上流の版、/flux が区間ごとの行に書く)。無ければ null
 * @param {string | null | undefined} ledgerText
 * @returns {string | null}
 */
export function lastUpstreamSha(ledgerText) {
  const shas = [...(ledgerText ?? "").matchAll(/^- id:.*\|\s*upstream:([0-9a-f]{7,40})\b/gm)].map((match) => match[1]);
  return shas.at(-1) ?? null;
}

/**
 * <rev>:<path> の blob の id(無ければ null)
 * @param {string} repoRoot
 * @param {string} rev
 * @param {string} path
 * @returns {string | null}
 */
const blobOf = (repoRoot, rev, path) => tryGit(repoRoot, ["rev-parse", "-q", "--verify", `${rev}:${path}`])?.trim() ?? null;

/**
 * 違反の行の HEAD の中身が上流の版と同じか(D479): (a) 基準 (b) 基準 + 台帳の picked: (c) 基準から親の ref までの履歴で
 * そのパスが持った版(各 commit の前と後の blob。基準より古い版は数えない)
 * @param {string} repoRoot
 * @param {{ base: string, parentRef: string | null, picks: string[], path: string, head: string | null, baseContent: string | null }} input
 * @returns {boolean}
 */
export function isUpstreamVersion(repoRoot, { base, parentRef, picks, path, head, baseContent }) {
  if (head === null) return false;
  if (baseContent !== null && head === baseContent) return true;
  if (picks.length > 0) {
    const after = textAfterPicks(repoRoot, picks, path, baseContent);
    if (after && after.text === head) return true;
  }
  const blob = blobOf(repoRoot, "HEAD", path);
  if (!blob || !parentRef) return false;
  const raw = tryGit(repoRoot, ["log", "--format=", "--raw", "--no-abbrev", "--no-renames", `${base}..${parentRef}`, "--", path]) ?? "";
  return raw.split("\n").some((line) => {
    const m = /^:\d+ \d+ ([0-9a-f]{40}) ([0-9a-f]{40}) /.exec(line);
    return m !== null && (m[1] === blob || m[2] === blob);
  });
}

/**
 * 台帳の本文の picked:<sha>(親の緊急修正を cherry-pick した元の commit)を書かれた順に
 * @param {string | null | undefined} ledgerText
 * @returns {string[]}
 */
export function pickedShas(ledgerText) {
  return [...(ledgerText ?? "").matchAll(/^- id:.*\|\s*picked:([0-9a-f]{7,40})\b/gm)].map((match) => match[1]);
}

/**
 * 3 方向の合成(git merge-file)。衝突・バイナリは null
 * @param {string} repoRoot
 * @param {string} current
 * @param {string} old
 * @param {string} next
 * @returns {string | null}
 */
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
 * @param {string} repoRoot
 * @param {string[]} picks
 * @param {string} path
 * @param {string | null} baseContent
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
 * @param {string} repoRoot
 * @param {string} ownerId
 * @returns {Tier1Version | { error: string }}
 */
function resolveTier1Version(repoRoot, ownerId) {
  /** @type {Tier1Version["chain"]} */
  const chain = [];
  /** @type {Set<string>} */
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
 * @param {string} repoRoot
 * @param {string | null} ownerId
 * @param {{ parent?: string, branch?: string, fetch?: boolean }} options
 * @returns {{ status?: undefined, ownerId: string | null, remote: string, branch: string, base: string, parentRef: string } | Unverified}
 */
function resolveParentBase(repoRoot, ownerId, { parent, branch, fetch }) {
  if (tryGit(repoRoot, ["rev-parse", "--is-shallow-repository"])?.trim() === "true") {
    return unverified("shallow clone では基準を求められない(git fetch --unshallow)", { ownerId });
  }
  const parentRemote = resolveParentRemote(repoRoot, parent);
  if (parentRemote.error !== undefined) return unverified(parentRemote.error, { ownerId });
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
 * @returns {{ status: "tier1", added: Set<string> } | { status: "ok", base: string, parentRef: string, added: Set<string> } | Unverified}
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
  /** @type {Map<string, string | null>} */
  const cache = new Map();
  const read = (/** @type {string} */ path) => {
    if (!cache.has(path)) cache.set(path, show(repoRoot, rev, path));
    return cache.get(path) ?? null;
  };
  const files = (tryGit(repoRoot, ["ls-tree", "-r", "--name-only", rev]) ?? "").split("\n").filter(Boolean);
  const libs = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", rev, "src/lib/"]) ?? "")
    .split("\n")
    .filter(Boolean)
    .map((path) => path.replace(/^src\/lib\//, ""));
  const hasCore = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", rev, "src/domains/core"]) ?? "").trim() !== "";
  const hasGate = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", rev, "src/featureGate"]) ?? "").trim() !== "";
  const hasRulesCore = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", rev, ".claude/rules/core"]) ?? "").trim() !== "";
  // 単位名の同名・自分の項目への override(D137 の印の代わり): 基準のファイルの単位と照らす
  return { rev, read, files, libs, hasCore, hasGate, hasRulesCore, places: unitPlaces(files, read), units: unitIndex(files) };
}

/**
 * fork の検査の前提をそろえる(runCheck と pnpm workflow ownership who の共通の入口)。順に: 名前の宣言 → Tier1 なら打ち切り →
 * 直接の親との基準 → 基準の受け口の一覧 → 鮮度(台帳に無い notice)→ Tier1 の版。どこかで欠ければ unverified(exit 2)
 * @param {string} repoRoot
 * @param {{ parent?: string, branch?: string, fetch?: boolean, base?: string }} [options]
 *   base = 基準にする版(既定 = 直接の親との merge-base)。pnpm workflow ownership who --base(/flux が取り込む区間の merge 先を渡す、D313)。
 *   基準を渡したときは「取り込み済みの notice が台帳に無い」で止めない(取り込みの途中の答え。所有の検査 check は渡さない)
 * @returns {{ status: "tier1", ownerId: string } | Unverified | ForkContext}
 */
export function resolveForkContext(repoRoot, { parent, branch, fetch = true, base: givenBase } = {}) {
  // 自分の名前と Tier1 の判定は forkIds.mjs だけが読む(project.md の fork_id:、CATALOG.md の先頭の節。origin は読まない、D27)
  const identity = readForkIdentity(repoRoot);
  const ownerId = identity.own;
  // 宣言に誤りが無ければ名前はある(own = null は errors に理由が入る)
  if (identity.errors.length > 0 || ownerId === null) {
    return unverified(`fork の名前の宣言に問題がある: ${identity.errors.join(" / ")}`, { ownerId });
  }
  if (identity.isTier1) return { status: "tier1", ownerId };

  const resolved = resolveParentBase(repoRoot, ownerId, { parent, branch, fetch });
  if (resolved.status === "unverified") return resolved;
  const { remote, branch: parentBranch, parentRef } = resolved;
  const base = givenBase === undefined ? resolved.base : tryGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${givenBase}^{commit}`])?.trim();
  if (!base) return unverified(`基準の版 ${givenBase} が無い`, { ownerId, remote, branch: parentBranch });
  const where = { ownerId, remote, branch: parentBranch, base };

  const intakeText = show(repoRoot, base, INTAKE_PATH);
  if (intakeText === null) return unverified(`基準に ${INTAKE_PATH} が無い(この検査を含む版をまだ取り込んでいない)`, where);
  const intake = parseIntake(intakeText);
  if (intake.errors.length > 0) return unverified(`基準の ${INTAKE_PATH} に書式の誤りがある`, { ...where, errors: intake.errors });

  const unrecorded = givenBase === undefined ? unrecordedNotices(repoRoot, base, parentRef, ownerId) : [];
  if (unrecorded.length > 0) {
    return unverified("取り込み済みの notice が台帳に無い(/flux で記録してから検査する)", { ...where, unrecorded });
  }

  // 多段(D29): Tier1 の版にあるファイルだけ厳密、無いファイル(中間 Tier 以下の物)は合格にして参考の一覧へ
  const tier1 = resolveTier1Version(repoRoot, ownerId);
  if ("error" in tier1) return unverified(tier1.error, where);
  const tier1Files = new Set((tryGit(repoRoot, ["ls-tree", "-r", "--name-only", tier1.sha]) ?? "").split("\n").filter(Boolean));

  return { status: "ok", ...where, downstream: identity.downstream, parentRef, intake: intake.rules, tier1: { sha: tier1.sha, chain: tier1.chain }, tier1Files };
}

const SERVICE_PREFIX = ".claude/rules/service/";
/** @type {Readonly<Record<string, string | undefined>>} core・門番・決まりの core への追加 → Tier1 の置き場 */
const TIER1_ADD_PREFIXES = { "core-add": "src/domains/core/", "gate-add": "src/featureGate/", "rules-core-add": ".claude/rules/core/" };

/**
 * Tier1 の版に無いファイルの違反を `middle-tier`(合格・参考)に付け替える(D29)。entries を書き換え、付け替えた分を返す
 * @param {Pick<OwnershipEntry, "status" | "path" | "from" | "reason" | "verdict" | "unitFolder">[]} entries judge の結果
 * @param {Set<string>} tier1Files
 * @returns {MiddleTierItem[]}
 */
export function reassignMiddleTier(entries, tier1Files) {
  /** @type {MiddleTierItem[]} */
  const middleTier = [];
  for (const entry of entries) {
    if (entry.verdict !== "violation") continue;
    // 同名・自分の項目への override・親の既定(*.default.*)の追加と書き換えは持ち主によらず止める(中間 Tier の物にしない。中間 Tier の既定も親の物、D169)
    if (entry.reason === "unit-clash" || entry.reason === "override-own" || entry.reason === "default-add" || entry.reason === "default-edit" || entry.reason === "frame-plain") continue;
    const target = (entry.status === "R" ? entry.from : undefined) ?? entry.path;
    // 上流の単位の中への追加: その単位のフォルダ(祖先の lib も)が Tier1 の版にあれば Tier1 の物(厳密)、無ければ中間 Tier の単位
    const folder = entry.reason === "inside-unit-add" ? (entry.unitFolder ?? /^src\/lib\/[^/]+(?=\/)/.exec(target)?.[0] ?? null) : null;
    // 業務の全体像 .claude/rules/service/ は中間 Tier が足した物も下流で直せない(D117: このフォルダだけ中間 Tier の付け替えをしない)
    if (target.startsWith(SERVICE_PREFIX)) continue;
    // 祖先の既定(*.default.*)の削除・名前の変更: 中間 Tier の既定も親の物(CLAUDE.md multi-tier の例外 an ancestor's .default)
    if ((entry.reason === "deleted" || entry.reason === "renamed") && isDefaultName(target)) continue;
    // core・門番・決まりの core への追加: どれも Tier1 の物(足したファイルは Tier1 の版に無いが、中間 Tier の物にしない)
    const tier1Prefix = TIER1_ADD_PREFIXES[entry.reason];
    const tier1Owned =
      tier1Prefix
        ? [...tier1Files].some((file) => file.startsWith(tier1Prefix))
        : folder
          ? [...tier1Files].some((file) => file.startsWith(`${folder}/`))
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
 * @param {string} repoRoot
 * @param {ForkContext} context
 * @returns {{
 *   entries: OwnershipEntry[], leftovers: PermitLeftover[], middleTier: MiddleTierItem[], permitFile: string, permitErrors: LineError[], permits: Permit[],
 *   snapshot: ReturnType<typeof treeSnapshot>, headText: (path: string) => string | null,
 * }}
 */
export function judgeFork(repoRoot, context) {
  const { ownerId, base, intake, tier1Files, parentRef } = context;
  const changes = parseNameStatus(git(repoRoot, ["diff", "--name-status", "-M", "-z", base, "HEAD"]));
  const snapshot = treeSnapshot(repoRoot, base);
  const baseText = snapshot.read;
  /** @type {Map<string, string | null>} */
  const headCache = new Map();
  const headText = (/** @type {string} */ path) => {
    if (!headCache.has(path)) headCache.set(path, show(repoRoot, "HEAD", path));
    return headCache.get(path) ?? null;
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
  // 上流の版と同じ中身は上流の物として通す(D479、決まり 1 つ): 違反の行の HEAD の中身が (a) 基準の版 (b) 基準に台帳の
  // picked: を順に当てた版 (c) 基準から親の ref までの履歴でそのパスが持ったどれかの版、のどれかと同じなら upstream-version
  // 基準より古い版は数えない。それ以外は違反のまま(fork 自身の変更 = push の前の止め)。
  // 既に基準に入った pick は差分に出ないので外す
  const picks = pickedShas(headText(`.notices/applied/${ownerId}.md`)).filter(
    (sha) => tryGit(repoRoot, ["cat-file", "-e", `${sha}^^{commit}`]) !== null && tryGit(repoRoot, ["merge-base", "--is-ancestor", sha, base]) === null,
  );
  for (const entry of judged.entries) {
    if (entry.verdict !== "violation") continue;
    if (!isUpstreamVersion(repoRoot, { base, parentRef, picks, path: entry.path, head: headText(entry.path), baseContent: baseText(entry.path) })) continue;
    entry.reason = "upstream-version";
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
    const target = (entry.status === "R" ? entry.from : undefined) ?? entry.path;
    const kind = matchIntake(intake, target)?.kind ?? null;
    const baseFp = entry.fingerprints?.base ?? fingerprint(baseText(target), kind);
    const headFp = entry.fingerprints?.head ?? (entry.status === "D" || entry.status === "R" ? "-" : fingerprint(headText(target), kind));
    entry.permitDraft = `${target} upreq:<依頼の番号> base:${baseFp} head:${headFp}  # <理由>`;
  }

  return { entries, leftovers, middleTier, permitFile, permitErrors: permitParse.errors, permits: permitParse.permits, snapshot, headText };
}

/**
 * 型 5 self の検査の入力を git から集めて判定する(self.mjs)。Tier1 は自分の受け口の一覧とファイルの有無だけ
 * 「取り込みで親の版が入った」の merge = 基準 base を 2 番目以降の親に持つ、HEAD から見て最新の merge。
 * その前に取り込んだ親の版 = merge の前(1 番目の親)と基準の分岐点
 * @param {string} repoRoot
 * @param {{ isTier1: boolean, base?: string | null, parentRef?: string | null }} input base / parentRef = 直接の親との基準と親の ref(fork だけ)
 * @returns {{ enabled: true, problems: SelfProblem[], asks: SelfProblem[], unverified: string[] }}
 */
export function collectSelf(repoRoot, { isTier1, base = null, parentRef = null }) {
  const head = Object.fromEntries(SELF_FILES.map((path) => [path, show(repoRoot, "HEAD", path)]));
  const intakeText = show(repoRoot, isTier1 ? "HEAD" : base, INTAKE_PATH);
  const selfRows = intakeText === null ? null : parseIntake(intakeText).rules.filter((rule) => rule.kind === "self").map((rule) => rule.glob);
  if (isTier1) return { enabled: true, ...selfProblems({ isTier1, selfRows, head, merge: null, parentNow: null }) };

  const lines = (tryGit(repoRoot, ["rev-list", "--merges", "--parents", "--ancestry-path", `${base}..HEAD`]) ?? "").split("\n").filter(Boolean);
  const mergeLine = lines.map((line) => line.split(" ")).find(([, , ...others]) => base !== null && others.includes(base));
  /** @type {{ found: boolean, before: Record<string, string | null>, base: Record<string, string | null>, prevBase?: Record<string, string | null> }} */
  let merge = { found: false, before: {}, base: {} };
  if (mergeLine && base !== null) {
    const [, firstParent] = mergeLine;
    const prevPoint = tryGit(repoRoot, ["merge-base", firstParent, base])?.trim() || null;
    merge = {
      found: true,
      before: Object.fromEntries(SELF_FILES.map((path) => [path, show(repoRoot, firstParent, path)])),
      base: Object.fromEntries(SELF_FILES.map((path) => [path, show(repoRoot, base, path)])),
      prevBase: Object.fromEntries(SELF_FILES.map((path) => [path, prevPoint ? show(repoRoot, prevPoint, path) : null])),
    };
  }
  const parentNow = show(repoRoot, parentRef, SELF_OVERVIEW_FILE);
  return { enabled: true, ...selfProblems({ isTier1, selfRows, head, merge, parentNow }) };
}

/**
 * @param {string} repoRoot
 * @param {{ parent?: string, branch?: string, fetch?: boolean, self?: boolean }} [options] fetch: false はテスト用(取得済みの ref で判定する)。
 *   self: 型 5 self の検査を走らせるか(省略 = SELF_CHECK_DEFAULT = 入)
 * @returns {CheckResult} status: tier1 | unverified | pass | fail
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
    /** @type {SelfResult} */
    const self = selfEnabled ? collectSelf(repoRoot, { isTier1: true }) : { enabled: false };
    return { status: "tier1", ownerId: context.ownerId, debt: own.rules.filter((rule) => rule.kind === "debt").map((rule) => rule.glob), self };
  }
  const { ownerId, remote, branch, base, tier1, downstream } = context;

  const { entries, leftovers, middleTier, permitFile, permitErrors, headText } = judgeFork(repoRoot, context);

  /** @type {Record<string, number>} */
  const counts = {};
  for (const entry of entries) {
    const key = entry.verdict === "permitted" ? "permitted" : entry.reason;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  for (const leftover of leftovers) counts[`permit-${leftover.reason}`] = (counts[`permit-${leftover.reason}`] ?? 0) + 1;

  // 中間層の規則(lineage.md)の並び・鍵。祖先の部分が基準どおりかは append の判定が見る。
  // chain は直接の親から上へ積むので、古い順は逆。lineage.md の無い fork(この版を取り込む前)は検査しない
  const lineageText = headText(LINEAGE_FILE);
  /** @type {LineageResult} */
  const lineage = { checked: lineageText !== null, failures: [] };
  if (lineageText !== null) {
    const parsed = parseLineage(lineageText);
    const ancestorsOldestFirst = tier1.chain.map((step) => step.name).reverse();
    lineage.failures.push(...checkLineageStructure({ parsed, ancestorsOldestFirst, own: ownerId, downstream }));
  }
  if (lineage.failures.length > 0) counts.lineage = lineage.failures.length;

  /** @type {SelfResult} */
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

/**
 * rev のツリーにファイル(blob)としてあるか(フォルダは false)
 * @param {string} repoRoot
 * @param {string} rev
 * @param {string} path
 * @returns {boolean}
 */
export const existsAt = (repoRoot, rev, path) => tryGit(repoRoot, ["cat-file", "-t", `${rev}:${path}`])?.trim() === "blob";

/**
 * rev のツリーで dir の下にあるファイル(dir がファイルなら空)
 * @param {string} repoRoot
 * @param {string} rev
 * @param {string} dir
 * @returns {string[]}
 */
export const filesUnder = (repoRoot, rev, dir) =>
  (tryGit(repoRoot, ["ls-tree", "-r", "--name-only", rev, "--", `${dir.replace(/\/+$/, "")}/`]) ?? "").split("\n").filter(Boolean);

/**
 * rev の版の名前(repo.json の repo_id を先に、無ければ古い形の project.md の fork_id:。無ければ null)
 * @param {string} repoRoot
 * @param {string} rev
 * @returns {string | null}
 */
export const forkIdAt = (repoRoot, rev) => forkIdOfTexts({ repoJson: show(repoRoot, rev, REPO_JSON_FILE), projectMd: show(repoRoot, rev, PROJECT_RULES_FILE) }).forkId ?? null;
