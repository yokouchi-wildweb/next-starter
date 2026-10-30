// 検査の本体: git から基準と差分・中身を取り、judge と checkPermits に渡す。対話なし(CI でも動く)
// 表示と終了コードは cli.mjs。仕様: ./README.md「使い方」「鮮度」

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseForkIdDeclaration, PROJECT_RULES_FILE, readForkIdentity } from "./forkIds.mjs";
import { matchIntake, parseIntake } from "./intake.mjs";
import { judge } from "./judge.mjs";
import { checkPermits, fingerprint, parsePermits, permitsPath } from "./permits.mjs";

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

/** 親の remote(/flux の「upstream の特定」と同じ: 指定 > 環境変数 > origin 以外が 1 つ) */
function resolveParentRemote(repoRoot, requested) {
  const remotes = (tryGit(repoRoot, ["remote"]) ?? "").split("\n").filter(Boolean);
  const wanted = requested ?? process.env[PARENT_ENV] ?? null;
  if (wanted) return remotes.includes(wanted) ? { remote: wanted } : { error: `remote ${wanted} が無い` };
  const others = remotes.filter((name) => name !== "origin");
  if (others.length === 1) return { remote: others[0] };
  if (others.length === 0) return { error: "親の remote が無い(origin 以外の remote を足すか --parent で指定する)" };
  return { error: `親の remote が決まらない(${others.join(", ")})。--parent か ${PARENT_ENV} で指定する` };
}

function resolveParentBranch(repoRoot, remote, requested) {
  if (requested) return requested;
  const out = tryGit(repoRoot, ["ls-remote", "--symref", remote, "HEAD"]);
  const match = out && /^ref: refs\/heads\/(\S+)\s+HEAD/m.exec(out);
  return match ? match[1] : null;
}

const noticeIds = (lsTreeOutput) =>
  (lsTreeOutput ?? "")
    .split("\n")
    .map((path) => /^\.notices\/([^/]+)\.md$/.exec(path)?.[1])
    .filter((id) => id && id !== "README");

/**
 * 取り込み済み(基準にある)なのに自分の台帳に記録の無い notice(L1.7)。
 * fork を作った時点のツリーにあった notice は継承済みとして除く(/flux と同じ求め方)。
 */
function unrecordedNotices(repoRoot, base, parentRef, ownerId) {
  const baseIds = noticeIds(tryGit(repoRoot, ["ls-tree", "--name-only", base, ".notices/"]));
  const own = (tryGit(repoRoot, ["rev-list", "--reverse", "HEAD", `^${parentRef}`]) ?? "").split("\n").filter(Boolean);
  if (own.length === 0) return [];
  const hasParent = tryGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${own[0]}^`]) !== null;
  const forkPoint = hasParent ? `${own[0]}^` : own[0];
  const inherited = new Set(noticeIds(tryGit(repoRoot, ["ls-tree", "--name-only", forkPoint, ".notices/"])));
  const ledger = show(repoRoot, "HEAD", `.notices/applied/${ownerId}.md`) ?? "";
  const recorded = new Set([...ledger.matchAll(/^- id:(\S+)/gm)].map((match) => match[1]));
  return baseIds.filter((id) => !inherited.has(id) && !recorded.has(id));
}

/**
 * 基準(取り込み済み)の notice の resolves: に書かれた指令 id(上流が解決した下流の依頼)。
 * .notices/ 直下と done/ の両方を読む(アーカイブされても解決は解決)。
 */
function resolvedOrders(repoRoot, base) {
  const files = (tryGit(repoRoot, ["ls-tree", "-r", "--name-only", base, ".notices/"]) ?? "")
    .split("\n")
    .filter((path) => /^\.notices\/(done\/)?[^/]+\.md$/.test(path) && !path.endsWith("/README.md"));
  const ids = new Set();
  for (const path of files) {
    const match = /^resolves:\s*(.+)$/m.exec(show(repoRoot, base, path) ?? "");
    if (!match) continue;
    for (const id of match[1].split(",").map((s) => s.trim()).filter(Boolean)) ids.add(id);
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
    const name = parseForkIdDeclaration(show(repoRoot, sha, PROJECT_RULES_FILE) ?? "").forkId;
    if (!name) return { error: `${sha.slice(0, 10)} の版(中間 Tier)に ${PROJECT_RULES_FILE} の fork_id: が無い(その Tier が名前の宣言を含む版を出していない)` };
    chain.push({ sha, name });
    from = sha.slice(0, 10);
    ledgerPath = `.notices/applied/${name}.md`;
    ledgerText = show(repoRoot, sha, ledgerPath);
    if (ledgerText === null) return { error: `${from} の版(${name})に ${ledgerPath} が無い(台帳の名前を fork_id: にそろえる)` };
  }
  return { error: `台帳を ${TIER1_WALK_LIMIT} 段たどっても Tier1 の版(.notices/applied/ の無い版)に着かない` };
}

/**
 * @param {string} repoRoot
 * @param {{ parent?: string, branch?: string, fetch?: boolean }} [options] fetch: false はテスト用(取得済みの ref で判定する)
 * @returns {object} status: tier1 | unverified | pass | fail
 */
export function runCheck(repoRoot, { parent, branch, fetch = true } = {}) {
  // 自分の名前と Tier1 の判定は forkIds.mjs だけが読む(project.md の fork_id:、CATALOG.md の先頭の節。origin は読まない、D27)
  const identity = readForkIdentity(repoRoot);
  const ownerId = identity.own;
  if (identity.errors.length > 0) {
    return unverified(`fork の名前の宣言に問題がある: ${identity.errors.join(" / ")}`, { ownerId });
  }
  if (identity.isTier1) {
    // Tier1 は検査の対象外。upstream の負債の行の数だけ返す(D29: 件数を Tier1 のコマンドと /inbox に出す)
    const own = parseIntake(show(repoRoot, "HEAD", INTAKE_PATH) ?? "");
    return { status: "tier1", ownerId, debt: own.rules.filter((rule) => rule.kind === "debt").map((rule) => rule.glob) };
  }

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

  const changes = parseNameStatus(git(repoRoot, ["diff", "--name-status", "-M", "-z", base, "HEAD"]));
  const cache = new Map();
  const read = (rev) => (path) => {
    const key = `${rev}:${path}`;
    if (!cache.has(key)) cache.set(key, show(repoRoot, rev, path));
    return cache.get(key);
  };
  const baseText = read(base);
  const headText = read("HEAD");
  const baseLibs = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", base, "src/lib/"]) ?? "")
    .split("\n")
    .filter(Boolean)
    .map((path) => path.replace(/^src\/lib\//, ""));

  const baseHasCore = (tryGit(repoRoot, ["ls-tree", "-d", "--name-only", base, "src/features/core"]) ?? "").trim() !== "";

  const judged = judge({ changes, baseText, headText, baseLibs, baseHasCore, intake: intake.rules });
  const middleTier = [];
  for (const entry of judged.entries) {
    if (entry.verdict !== "violation") continue;
    const target = entry.status === "R" ? entry.from : entry.path;
    // 祖先の lib への追加: その lib が Tier1 の版にあれば Tier1 の物(厳密)、無ければ中間 Tier の lib
    const lib = entry.reason === "ancestor-lib-add" ? /^src\/lib\/([^/]+)\//.exec(target)?.[1] : null;
    // core への追加: core は Tier1 の物(足したファイルは Tier1 の版に無いが、中間 Tier の物にしない)
    const tier1Owned =
      entry.reason === "core-add"
        ? [...tier1Files].some((file) => file.startsWith("src/features/core/"))
        : lib
          ? [...tier1Files].some((file) => file.startsWith(`src/lib/${lib}/`))
          : tier1Files.has(target);
    if (tier1Owned) continue;
    middleTier.push({ path: entry.path, from: entry.from, was: entry.reason });
    entry.reason = "middle-tier";
    entry.verdict = "ok";
  }
  // 親の緊急修正の pick(台帳の picked:)。基準 + pick と同じ中身なら違反にしない(fork が更に変えた分は違反のまま)。
  // 既に基準に入った pick は差分に出ないので外す
  const picks = pickedShas(headText(`.notices/applied/${ownerId}.md`)).filter(
    (sha) => tryGit(repoRoot, ["cat-file", "-e", `${sha}^^{commit}`]) !== null && tryGit(repoRoot, ["merge-base", "--is-ancestor", sha, base]) === null,
  );
  for (const entry of judged.entries) {
    if (entry.verdict !== "violation" || picks.length === 0) continue;
    const targets = entry.from ? [entry.from, entry.path] : [entry.path];
    const onlyPicked = targets.every((path) => {
      const after = textAfterPicks(repoRoot, picks, path, baseText(path));
      return after?.touched && after.text === headText(path);
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
    intake: intake.rules,
    resolvedUpreqs: resolvedOrders(repoRoot, base),
  });

  // 許可の行の下書き(違反だけ。今の指紋で書く)
  for (const entry of entries) {
    if (entry.verdict !== "violation") continue;
    const target = entry.status === "R" ? entry.from : entry.path;
    const kind = matchIntake(intake.rules, target)?.kind ?? null;
    const baseFp = entry.fingerprints?.base ?? fingerprint(baseText(target), kind);
    const headFp = entry.fingerprints?.head ?? (entry.status === "D" || entry.status === "R" ? "-" : fingerprint(headText(target), kind));
    entry.permitDraft = `${target} upreq:<依頼の番号> base:${baseFp} head:${headFp}  # <理由>`;
  }

  const counts = {};
  for (const entry of entries) {
    const key = entry.verdict === "permitted" ? "permitted" : entry.reason;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  for (const leftover of leftovers) counts[`permit-${leftover.reason}`] = (counts[`permit-${leftover.reason}`] ?? 0) + 1;

  const violations = entries.filter((entry) => entry.verdict === "violation");
  const failed = violations.length > 0 || leftovers.length > 0 || permitParse.errors.length > 0;
  return {
    status: failed ? "fail" : "pass",
    ...where,
    tier1: { sha: tier1.sha, chain: tier1.chain },
    middleTier,
    permitFile,
    permitErrors: permitParse.errors,
    counts,
    entries,
    leftovers,
  };
}
