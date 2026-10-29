// 検査の本体: git から基準と差分・中身を取り、judge と checkPermits に渡す。対話なし(CI でも動く)
// 表示と終了コードは cli.mjs。仕様: ./README.md「使い方」「鮮度」

import { execFileSync } from "node:child_process";

import { parseCatalog, resolveOwnerId } from "../folderCatalog/catalog.mjs";

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

/** 自分が Tier1(CATALOG.md の先頭の節の持ち主)か。所有者 ID が分からなければ null */
function isTier1(repoRoot, ownerId) {
  const catalog = show(repoRoot, "HEAD", "src/lib/CATALOG.md");
  if (catalog === null || ownerId === null) return null;
  return parseCatalog(catalog).sections[0]?.owner === ownerId;
}

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

/**
 * @param {string} repoRoot
 * @param {{ parent?: string, branch?: string, fetch?: boolean }} [options] fetch: false はテスト用(取得済みの ref で判定する)
 * @returns {object} status: tier1 | unverified | pass | fail
 */
export function runCheck(repoRoot, { parent, branch, fetch = true } = {}) {
  const ownerId = resolveOwnerId(repoRoot);
  const tier1 = isTier1(repoRoot, ownerId);
  if (tier1 === null) return unverified("自分の所有者 ID か src/lib/CATALOG.md が読めない(origin を確かめる)", { ownerId });
  if (tier1) return { status: "tier1", ownerId };

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

  const judged = judge({ changes, baseText, headText, baseLibs, intake: intake.rules });
  const permitFile = permitsPath(ownerId);
  const permitParse = parsePermits(headText(permitFile) ?? "");
  const { entries, leftovers } = checkPermits({
    entries: judged.entries,
    permits: permitParse.permits,
    baseText,
    headText,
    intake: intake.rules,
    resolvedUpreqs: [], // notice の resolves: 欄ができるまで空(L1.6)
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
    permitFile,
    permitErrors: permitParse.errors,
    counts,
    entries,
    leftovers,
  };
}
