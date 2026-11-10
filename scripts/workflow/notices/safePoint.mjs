// scripts/workflow/notices/safePoint.mjs
// セーフポイント = 全部の検査(pnpm test 全体・pnpm check・pnpm typecheck・pnpm lint・pnpm build)が通って push された先端に付ける
// 注釈つきの tag `safe/<fork_id>/<YYYYMMDD>-<n>`(fork_id = 付けたリポの .claude/rules/project.md の fork_id:、n = その fork_id と日の次の空き番号)。
// 名前に fork_id が入るので親子の tag は重ならず、見るのは直接の親の `safe/<親の fork_id>/*` だけ。
// 仕様 = .notices/README.md「区切り(checkpoint)と区間適用」のセーフポイント。使う所: /ship --safe(check → push → tag)、/flux の区間の報告(where)、
// 本番のデプロイの止め(deployVerdict。scripts/operations/deploy/lib.ts の guardSafePoint)。
//
// 実行: pnpm workflow notices safePoint <動作>
//   check [--check=<cmd> ...]   作業ツリー = HEAD を確かめ、全部の検査を順に回す。全部通れば HEAD を「検査済み」と記録する
//                               (<git dir>/safe-point-pass)。--check = 検査を差し替える(繰り返し可。テスト用)
//   tag [--remote=origin] [--branch=<b>] [--date=YYYYMMDD]
//                               HEAD = push 済みの <remote>/<branch> かつ HEAD = check の記録 のときだけ、HEAD に tag を付けて push する
//   where [--remote=<name>] [--at=<sha>] [--id=<fork_id>]
//                               <at>(既定 = 自分の台帳の最後の upstream:<sha>)と <remote>(既定 = 親の remote)の safe/<id>/* の関係を 1 行:
//                               at <tag> | past <tag> (N commits unverified) | before <tag> | no safe point yet
//   status [--remote=origin] [--commits=80] [--days=3] [--now=<unix 秒>]
//                               自分の safe/<own>/* のうち HEAD の祖先で一番新しいものから、HEAD まで何 commit(--first-parent)・何日か。
//                               値 = commits ÷ --commits + 日数 ÷ --days。1 以上(tag が無く commit が 1 つ以上も)なら 2 行目に propose。
//                               /ship のふつうの出荷の報告が使う(セーフポイントを作るかの提案)
//   quickFiles                  HEAD から --first-parent でさかのぼり、`Ship: quick` の trailer がある commit が続く間(手元の自分の
//                               safe tag の commit で止まる)を集め、1 行目に `<N> quick commits unchecked`、続けて変わったファイルを 1 行ずつ。
//                               /ship のふつうの出荷が、まだ検査していない quick の分を範囲に足すのに使う
//   exit 0 = 通った | 1 = 検査が落ちた・tag を付けられない | 2 = 回せない・確かめられない(理由を出す)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseForkIdDeclaration, PROJECT_RULES_FILE, readForkIdentity } from "../../../src/lib/forkOwnership/forkIds.mjs";
import { lastUpstreamSha, resolveParentBranch, resolveParentRemote } from "../../../src/lib/forkOwnership/check.mjs";

export const SAFE_NAME = /^safe\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(\d{8})-([1-9]\d*)$/;
export const FULL_CHECKS = ["pnpm test", "pnpm check", "pnpm typecheck", "pnpm lint", "pnpm build"];
export const PASS_FILE = "safe-point-pass";

const UNSAFE_SUFFIX = "(どうしても出すなら --allow-unsafe=<理由>)";
const VERDICT_HEAD = "本番に出せません: ";

/** git を回して stdout(末尾の改行を落とす)。失敗は throw(stderr は Error の stderr に残る) */
const git = (repo, args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).replace(/\n$/, "");

/** 失敗を null にする git */
const tryGit = (repo, args) => {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
};

const firstLine = (error) => String(error?.stderr || error?.message || error).trim().split("\n")[0];
const short = (sha) => sha.slice(0, 8);

export const tagPrefix = (forkId) => `safe/${forkId}/`;

const byOrder = (a, b) => {
  const [, , dateA, nA] = SAFE_NAME.exec(a.tag);
  const [, , dateB, nB] = SAFE_NAME.exec(b.tag);
  return dateA === dateB ? Number(nA) - Number(nB) : dateA < dateB ? -1 : 1;
};

/**
 * `git for-each-ref refs/tags/safe/ --format='%(refname:strip=2) %(*objectname) %(objectname)'` の出力から、forkId の safe tag を
 * 古い順(日付、同じ日は n の数の順)に。注釈つきの tag は剥がした commit(*objectname)、軽い tag は objectname
 * @returns {{ tag: string, commit: string }[]}
 */
export function parseSafeTags(text, forkId) {
  const tags = [];
  for (const line of (text ?? "").split("\n")) {
    const [tag, peeled, object] = line.trim().split(" ");
    const match = tag && SAFE_NAME.exec(tag);
    if (!match || match[1] !== forkId) continue;
    const commit = peeled || object;
    if (commit) tags.push({ tag, commit });
  }
  return tags.sort(byOrder);
}

/** <remote> の tag を取ってから、forkId の safe tag を古い順に。取れなければ throw */
export function readSafeTags(repo, remote, forkId) {
  try {
    git(repo, ["fetch", remote, "--tags"]);
  } catch (error) {
    throw new Error(`${remote} の tag を取れない: ${firstLine(error)}`);
  }
  return parseSafeTags(git(repo, ["for-each-ref", "refs/tags/safe/", "--format=%(refname:strip=2) %(*objectname) %(objectname)"]), forkId);
}

/** 直接の親の fork_id(<remote>/<既定のブランチ> の .claude/rules/project.md の fork_id:)。読めなければ throw */
export function parentForkId(repo, remote) {
  const branch = resolveParentBranch(repo, remote);
  if (!branch) throw new Error(`${remote} の既定のブランチが分からない`);
  const text = tryGit(repo, ["show", `${remote}/${branch}:${PROJECT_RULES_FILE}`]);
  if (text === null) throw new Error(`${remote}/${branch} に project.md が無い`);
  const { forkId, error } = parseForkIdDeclaration(text);
  if (!forkId) throw new Error(`親の fork_id が読めない: ${error}`);
  return forkId;
}

const ymd = (date) => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

/** 次の tag の名前: その forkId と日の最大の n + 1(無ければ 1。他の fork_id・日は見ない。抜けた番号は使わない) */
export function nextTagName(forkId, names, date) {
  const day = ymd(date);
  let max = 0;
  for (const name of names) {
    const match = SAFE_NAME.exec(name);
    if (match && match[1] === forkId && match[2] === day) max = Math.max(max, Number(match[3]));
  }
  return `${tagPrefix(forkId)}${day}-${max + 1}`;
}

const hasCommit = (repo, sha) => tryGit(repo, ["cat-file", "-e", `${sha}^{commit}`]) !== null;
const isAncestor = (repo, older, newer) => spawnSync("git", ["merge-base", "--is-ancestor", older, newer], { cwd: repo, stdio: "ignore" }).status === 0;

/**
 * target(手元にある commit の完全な sha)と tags(古い順)の関係
 * @returns {{ kind: "at" | "past" | "before" | "none", tag?: string, unverified?: number }}
 */
export function classify(repo, target, tags) {
  const at = tags.filter((t) => t.commit === target).at(-1);
  if (at) return { kind: "at", tag: at.tag };
  const present = tags.filter((t) => hasCommit(repo, t.commit));
  const past = present.filter((t) => isAncestor(repo, t.commit, target)).at(-1);
  if (past) return { kind: "past", tag: past.tag, unverified: Number(git(repo, ["rev-list", "--count", `${past.commit}..${target}`])) };
  const before = present.find((t) => isAncestor(repo, target, t.commit));
  if (before) return { kind: "before", tag: before.tag };
  return { kind: "none" };
}

/** classify の結果を 1 行に */
export function describe(c) {
  if (c.kind === "at") return `at ${c.tag}`;
  if (c.kind === "past") return `past ${c.tag} (${c.unverified} commits unverified)`;
  if (c.kind === "before") return `before ${c.tag}`;
  return "no safe point yet";
}

/** target を真の祖先に持つ最初の tag(古い順)。無ければ null(デプロイの止めの案内に使う) */
export function nextAhead(repo, target, tags) {
  return tags.find((t) => t.commit !== target && hasCommit(repo, t.commit) && isAncestor(repo, target, t.commit)) ?? null;
}

const refuse = (reason) => ({ ok: false, line: "", message: `${VERDICT_HEAD}${reason}${UNSAFE_SUFFIX}` });
const refuseUnchecked = (reason) => refuse(`セーフポイントを確かめられません — ${reason}`);

/**
 * 本番のデプロイに出してよいか: fork = 台帳の最後の upstream:<sha> が直接の親の safe/<親の fork_id>/* ちょうど、
 * Tier1 = HEAD が safe/<自分の fork_id>/* ちょうど
 * @returns {{ ok: boolean, line: string, message: string }}
 */
export function deployVerdict(repo, { readTags = readSafeTags, readParentId = parentForkId } = {}) {
  const identity = readForkIdentity(repo);
  if (identity.errors.length > 0) return refuseUnchecked(identity.errors.join("、"));
  let remote;
  let forkId;
  let target;
  if (identity.isTier1) {
    remote = "origin";
    forkId = identity.own;
    target = tryGit(repo, ["rev-parse", "HEAD"]);
    if (!target) return refuseUnchecked("HEAD が読めない");
  } else {
    const ledgerPath = join(repo, ".notices/applied", `${identity.own}.md`);
    const sha = existsSync(ledgerPath) ? lastUpstreamSha(readFileSync(ledgerPath, "utf8")) : null;
    if (!sha) return refuseUnchecked(`台帳 .notices/applied/${identity.own}.md に upstream:<sha> が無い(/flux で取り込んでから)`);
    const parent = resolveParentRemote(repo);
    if (parent.error) return refuseUnchecked(parent.error);
    remote = parent.remote;
    try {
      forkId = readParentId(repo, remote);
    } catch (error) {
      return refuseUnchecked(error.message);
    }
    target = tryGit(repo, ["rev-parse", "--verify", `${sha}^{commit}`]);
    if (!target) return refuseUnchecked(`upstream:${short(sha)} が履歴に無い(git fetch ${remote} の後でもう一度)`);
  }
  let tags;
  try {
    tags = readTags(repo, remote, forkId);
  } catch (error) {
    return refuseUnchecked(error.message);
  }
  const c = classify(repo, target, tags);
  const line = describe(c);
  if (c.kind === "at") return { ok: true, line, message: `セーフポイント ${c.tag} の上にいます` };
  if (identity.isTier1) {
    return { ...refuse(`HEAD ${short(target)} はセーフポイントではありません(${line})。/ship --safe で先端にセーフポイントを付けてから出してください`), line };
  }
  const ahead = nextAhead(repo, target, tags);
  if (ahead) {
    return {
      ...refuse(`取り込んだ上流の位置 ${short(target)} は直接の親(${remote})のセーフポイントではありません(${line})。次のセーフポイント ${ahead.tag} まで /flux で進めてください(/flux to ${short(ahead.commit)})`),
      line,
    };
  }
  if (c.kind === "past") {
    return {
      ...refuse(`取り込んだ上流の位置 ${short(target)} は直接の親(${remote})のセーフポイント ${c.tag} から ${c.unverified} commits 先です。親の次のセーフポイントを待ち、/flux でそこまで進めてください`),
      line,
    };
  }
  return { ...refuse(`直接の親(${remote}、${forkId})にまだセーフポイントがありません`), line };
}

/** --name=value の値(最後のもの)。無ければ null */
const option = (argv, name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3)).at(-1) ?? null;

const passFilePath = (repo) => resolve(repo, git(repo, ["rev-parse", "--git-path", PASS_FILE]));
const dirtyFiles = (repo) => git(repo, ["status", "--porcelain", "--untracked-files=no"]);

function runCheck(repo, argv, log) {
  const checks = argv.filter((a) => a.startsWith("--check=")).map((a) => a.slice("--check=".length));
  if (dirtyFiles(repo) !== "") {
    log("safe-point: 作業ツリーが HEAD と違う(commit していない変更がある)。セーフポイントは付けない");
    return 2;
  }
  const passFile = passFilePath(repo);
  rmSync(passFile, { force: true });
  for (const cmd of checks.length > 0 ? checks : FULL_CHECKS) {
    const r = spawnSync(cmd, { cwd: repo, shell: true, stdio: "inherit" });
    if (r.status !== 0) {
      log(`safe-point: ${cmd} が落ちた。セーフポイントは付けない`);
      return 1;
    }
  }
  const changed = dirtyFiles(repo);
  if (changed !== "") {
    const files = changed
      .split("\n")
      .map((l) => l.slice(3))
      .join(", ");
    log(`safe-point: 検査が追跡中のファイルを変えた(${files})。セーフポイントは付けない`);
    return 2;
  }
  const head = git(repo, ["rev-parse", "HEAD"]);
  writeFileSync(passFile, `${head}\n`);
  log(`safe-point: 全部の検査が通った(${short(head)})`);
  return 0;
}

function parseDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value ?? "");
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function runTag(repo, argv, log) {
  const identity = readForkIdentity(repo);
  if (!identity.own || identity.errors.length > 0) {
    log(`safe-point: fork_id が読めない: ${identity.errors.join("、")}`);
    return 2;
  }
  const forkId = identity.own;
  const remote = option(argv, "remote") ?? "origin";
  const dateOption = option(argv, "date");
  const date = dateOption === null ? new Date() : parseDate(dateOption);
  if (!date) {
    log(`safe-point: --date=${dateOption} は YYYYMMDD の形でない`);
    return 2;
  }
  const branch = option(argv, "branch") ?? resolveParentBranch(repo, remote) ?? "main";
  try {
    git(repo, ["fetch", "--no-tags", remote, branch]);
  } catch (error) {
    log(`safe-point: ${remote}/${branch} を取れない: ${firstLine(error)}`);
    return 2;
  }
  const head = git(repo, ["rev-parse", "HEAD"]);
  if (head !== tryGit(repo, ["rev-parse", `refs/remotes/${remote}/${branch}`])) {
    log(`safe-point: 先端 ${short(head)} が ${remote}/${branch} と違う(push されていない・先に進んでいる)。tag なし`);
    return 1;
  }
  const passFile = passFilePath(repo);
  if (!existsSync(passFile) || readFileSync(passFile, "utf8").trim() !== head) {
    log("safe-point: 全部の検査が通った記録が HEAD に無い(先に safePoint check)。tag なし");
    return 1;
  }
  let tags;
  try {
    tags = readSafeTags(repo, remote, forkId);
  } catch (error) {
    log(`safe-point: ${error.message}`);
    return 2;
  }
  const existing = tags.find((t) => t.commit === head);
  if (existing) {
    log(`safe-point: ${existing.tag} が既にある`);
    rmSync(passFile, { force: true });
    return 0;
  }
  const name = nextTagName(
    forkId,
    tags.map((t) => t.tag),
    date,
  );
  git(repo, ["tag", "-a", name, "-m", "safe point: pnpm test / check / typecheck / lint / build passed", "HEAD"]);
  try {
    git(repo, ["push", remote, `refs/tags/${name}`]);
  } catch (error) {
    tryGit(repo, ["tag", "-d", name]);
    log(`safe-point: ${name} を push できない: ${firstLine(error)}`);
    return 1;
  }
  rmSync(passFile, { force: true });
  log(`safe-point: ${name} を付けて push した(${short(head)})`);
  return 0;
}

function runWhere(repo, argv, log) {
  try {
    let remote = option(argv, "remote");
    if (remote === null) {
      const parent = resolveParentRemote(repo);
      if (parent.error) throw new Error(parent.error);
      remote = parent.remote;
    }
    const id = option(argv, "id") ?? parentForkId(repo, remote);
    let at = option(argv, "at");
    if (at === null) {
      const own = readForkIdentity(repo).own;
      if (!own) throw new Error("fork_id が読めない");
      const ledgerPath = join(repo, ".notices/applied", `${own}.md`);
      at = existsSync(ledgerPath) ? lastUpstreamSha(readFileSync(ledgerPath, "utf8")) : null;
      if (!at) throw new Error(`台帳 .notices/applied/${own}.md に upstream:<sha> が無い`);
    }
    const target = tryGit(repo, ["rev-parse", "--verify", `${at}^{commit}`]);
    if (!target) throw new Error(`${at} が履歴に無い(git fetch ${remote} の後でもう一度)`);
    log(describe(classify(repo, target, readSafeTags(repo, remote, id))));
    return 0;
  } catch (error) {
    log(`safe-point: ${error.message}`);
    return 2;
  }
}

export const PROPOSE_COMMITS = 80;
export const PROPOSE_DAYS = 3;
export const QUICK_TRAILER = "Ship: quick";
const QUICK_WALK_LIMIT = 1000;

/** セーフポイントを作る提案の値: commits ÷ perCommits + days ÷ perDays(小数 2 桁) */
export function proposeScore(commits, days, perCommits = PROPOSE_COMMITS, perDays = PROPOSE_DAYS) {
  return Math.round((commits / perCommits + days / perDays) * 100) / 100;
}

/** 正の数の option。無ければ fallback、数でなければ null */
const positive = (argv, name, fallback) => {
  const value = option(argv, name);
  if (value === null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function runStatus(repo, argv, log) {
  try {
    const identity = readForkIdentity(repo);
    if (!identity.own || identity.errors.length > 0) throw new Error(`fork_id が読めない: ${identity.errors.join("、")}`);
    const remote = option(argv, "remote") ?? "origin";
    const perCommits = positive(argv, "commits", PROPOSE_COMMITS);
    const perDays = positive(argv, "days", PROPOSE_DAYS);
    const now = positive(argv, "now", Date.now() / 1000);
    if (perCommits === null || perDays === null || now === null) throw new Error("--commits / --days / --now は正の数");
    const head = git(repo, ["rev-parse", "HEAD"]);
    const tags = readSafeTags(repo, remote, identity.own);
    const last = tags.filter((t) => hasCommit(repo, t.commit) && isAncestor(repo, t.commit, head)).at(-1);
    if (!last) {
      const commits = Number(git(repo, ["rev-list", "--count", "--first-parent", "HEAD"]));
      log(`no safe point yet (${commits} commits)`);
      if (commits > 0) log("propose");
      return 0;
    }
    const commits = Number(git(repo, ["rev-list", "--count", "--first-parent", `${last.commit}..HEAD`]));
    const created = Number(git(repo, ["for-each-ref", `refs/tags/${last.tag}`, "--format=%(creatordate:unix)"]));
    const days = Math.max(0, Math.round(((now - created) / 86400) * 10) / 10);
    if (commits === 0) {
      log(`at ${last.tag} (${days} days)`);
      return 0;
    }
    const score = proposeScore(commits, days, perCommits, perDays);
    log(`past ${last.tag} (${commits} commits, ${days} days, score ${score})`);
    if (score >= 1) log("propose");
    return 0;
  } catch (error) {
    log(`safe-point: ${error.message}`);
    return 2;
  }
}

function runQuickFiles(repo, log) {
  try {
    const identity = readForkIdentity(repo);
    const own = identity.own;
    const safeCommits = new Set(
      own
        ? parseSafeTags(tryGit(repo, ["for-each-ref", "refs/tags/safe/", "--format=%(refname:strip=2) %(*objectname) %(objectname)"]), own).map(
            (t) => t.commit,
          )
        : [],
    );
    const out = git(repo, ["log", "--first-parent", `-n${QUICK_WALK_LIMIT + 1}`, "--format=%H %(trailers:key=Ship,valueonly,separator=%x2C)"]);
    const rows = out === "" ? [] : out.split("\n");
    let count = 0;
    let base = null;
    for (const row of rows) {
      const [sha, ...rest] = row.split(" ");
      const values = rest.join(" ").split(",").map((v) => v.trim());
      if (safeCommits.has(sha) || !values.includes("quick")) {
        base = sha;
        break;
      }
      count += 1;
    }
    if (count === 0) {
      log("0 quick commits unchecked");
      return 0;
    }
    if (base === null) {
      throw new Error(
        rows.length > QUICK_WALK_LIMIT ? `quick の commit が ${QUICK_WALK_LIMIT} を超えて続く` : "履歴の最初まで quick の commit が続く(検査済みの起点が無い)",
      );
    }
    const files = git(repo, ["diff", "--name-only", base, "HEAD"]);
    log(`${count} quick commits unchecked`);
    for (const file of files === "" ? [] : files.split("\n")) log(file);
    return 0;
  } catch (error) {
    log(`safe-point: ${error.message}`);
    return 2;
  }
}

/** 入口: 終了コードを返す */
export function run(repo, argv, { log = console.log } = {}) {
  const [action, ...rest] = argv;
  if (action === "check") return runCheck(repo, rest, log);
  if (action === "tag") return runTag(repo, rest, log);
  if (action === "where") return runWhere(repo, rest, log);
  if (action === "status") return runStatus(repo, rest, log);
  if (action === "quickFiles") return runQuickFiles(repo, log);
  log(
    "使い方: pnpm workflow notices safePoint check [--check=<cmd> ...] | tag [--remote=origin] [--branch=<b>] [--date=YYYYMMDD] | where [--remote=<name>] [--at=<sha>] [--id=<fork_id>] | status [--remote=origin] [--commits=80] [--days=3] [--now=<unix 秒>] | quickFiles",
  );
  return 2;
}

function main(argv) {
  return run(join(dirname(fileURLToPath(import.meta.url)), "../../.."), argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
