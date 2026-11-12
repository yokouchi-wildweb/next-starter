// .claude/skills/flux/incoming.mjs — /flux の流入の発見と区間の組み立て(手順 SKILL.md「UNAPPLIED JUDGMENT」「BUILDING SEGMENTS」、多段 relay.md)
// 上流の先端の消えない索引 .notices/shipped/*.md(1 notice = 1 行)と、notice を足した commit の履歴だけで決める。
// notice の本文は読まない(本文を読む場所 <足した commit>:<パス> を出すだけ)ので、区間が閉じた本文が消えても答えは変わらない。
//
// 自己完結(このファイルの外を import しない): /flux は手順書と付属ファイルを上流の先端の版で読むので、
//   git show <upstream>/<branch>:.claude/skills/flux/incoming.mjs > <一時ファイル> && node <一時ファイル> --upstream=<upstream>/<branch>
// で、索引や scripts/workflow/notices がまだ届いていない遅れた fork でも先端の判定で動く(cwd = fork のリポ)。
// 行の書式は scripts/workflow/notices/shippedIndex.mjs と同じ(- id:<id> | key:value …、本文にある欄だけ。仕様 .notices/README.md)。
//
// 実行: node .claude/skills/flux/incoming.mjs --upstream=<remote>/<branch> [--json] [--from=index|bodies]
//   --from=bodies = 索引の代わりに先端の .notices の本文(直下と done/)の欄から同じ行を作る(索引の導入前の方法。比べる用)
//   未適用 = 先端の全索引の行 − 自分の索引の行 − 継承済み(fork 成立点の索引の行 ∪ その木の .notices)− 自分の台帳
//            − covers 側が適用済みの covered
//   区切り点 = 直接の親の行は notice を足した commit、祖父の行は直上 Tier の台帳にその id が載った commit(無ければ足した commit + 警告)
//   区切り = 行の checkpoint がラベルか欄なし。ただし先端のどれかの行の skip_checkpoint: <id> に名指された物は - とみなす
//   区間 0 = 区切り点が HEAD の祖先。以降は区切り点の履歴順に、区切りの直後で閉じる。最後の区切り以降 + 残りの commit = 末尾区間
//   offLine = 前の位置(HEAD と先端の merge-base / 前の区間の merge 先)が merge 先の祖先でない区間(脇の commit。mainline = 本線でそれを含む最初の commit)
//   exit 0 = 出した | 2 = 止まる(浅い clone・行があるのに足した commit が無い・区切り点が先端の祖先でない・repo_id が無い)| 3 = 先端に索引が無い(今の手順で進める)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const NOTICE_FILE = /^\.notices\/(?:done\/)?(\d{8}-\d{6}-[^/]+)\.md$/;
const ROW_KEYS = ["severity", "checkpoint", "covers", "moved", "fixes", "resolves", "hotfix", "uses", "pick", "skip_checkpoint"];

class Stop extends Error {
  constructor(message, code = 2) {
    super(message);
    this.code = code;
  }
}

/** 索引の 1 行 → { id, fields }。行でなければ null */
export function parseRow(line) {
  if (!line.startsWith("- id:")) return null;
  const [head, ...rest] = line.slice(2).split(" | ");
  const fields = {};
  for (const part of rest) {
    const i = part.indexOf(":");
    if (i > 0) fields[part.slice(0, i)] = part.slice(i + 1);
  }
  return { id: head.slice("id:".length), fields };
}

/** notice 本文 → { id, fields(行と同じ欄), from }(--from=bodies 用) */
export function rowFromBody(text) {
  const lines = text.split("\n");
  const head = lines[0].match(/^# DOWNSTREAM NOTICE id:(\S+)\s*$/);
  const all = {};
  for (const line of lines.slice(1)) {
    const m = line.match(/^([a-z_]+):\s?(.*)$/);
    if (m && !(m[1] in all)) all[m[1]] = m[2].trim();
  }
  const fields = {};
  for (const k of ROW_KEYS) if (k in all) fields[k] = k === "hotfix" ? "yes" : all[k];
  return { id: head ? head[1] : null, fields, from: all.from ?? "" };
}

const list = (v) => (v ?? "").split(",").map((s) => s.trim()).filter((s) => s && s !== "-");

/** 区切りか(欄なし = 区切り、skip_checkpoint: に名指されたら - とみなす) */
export function isBreak(row, skipped) {
  if (skipped.has(row.id)) return false;
  return !("checkpoint" in row.fields) || row.fields.checkpoint !== "-";
}

/** repo URL の表記差(ssh / https・.git・末尾 /)を消す */
export function normalizeUrl(url) {
  return url
    .trim()
    .replace(/^[a-z+]+:\/\//, "")
    .replace(/^[^@/]+@/, "")
    .replace(/:(?!\d)/, "/")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function makeGit(repo) {
  const git = (args) => execFileSync("git", ["-C", repo, "-c", "core.quotePath=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });
  const tryGit = (args) => {
    try {
      return git(args);
    } catch {
      return null;
    }
  };
  const isAncestor = (a, b) => tryGit(["merge-base", "--is-ancestor", a, b]) !== null;
  return { git, tryGit, isAncestor };
}

/** ref の木の notice の id(直下と done/) */
function treeNoticeIds(g, ref) {
  return (g.tryGit(["ls-tree", "-r", "--name-only", ref, "--", ".notices/"]) ?? "")
    .split("\n")
    .map((p) => p.match(NOTICE_FILE)?.[1])
    .filter(Boolean);
}

/** ref の木の全索引の行: [{ owner, row }] */
function indexRows(g, ref) {
  const files = (g.tryGit(["ls-tree", "--name-only", ref, "--", ".notices/shipped/"]) ?? "").split("\n").filter((p) => /^\.notices\/shipped\/[^/]+\.md$/.test(p));
  return files.flatMap((f) => {
    const owner = f.slice(".notices/shipped/".length, -3);
    return g.git(["show", `${ref}:${f}`]).split("\n").map(parseRow).filter(Boolean).map((row) => ({ owner, row }));
  });
}

/** 先端の本文から行を作る(--from=bodies)。owner は from: の URL で own / 直上 / 祖父 に分ける */
function bodyRows(g, tip, { own, mid, originUrl, upstreamUrl }) {
  const paths = (g.tryGit(["ls-tree", "-r", "--name-only", tip, "--", ".notices/"]) ?? "").split("\n").filter((p) => NOTICE_FILE.test(p));
  return paths.map((p) => {
    const r = rowFromBody(g.git(["show", `${tip}:${p}`]));
    const repoUrl = normalizeUrl((r.from.match(/^(\S+)/) ?? ["", ""])[1].replace(/[|,].*$/, ""));
    const owner = originUrl && repoUrl === originUrl ? own : !upstreamUrl || repoUrl === upstreamUrl || !repoUrl ? mid : `grandparent:${repoUrl}`;
    return { owner, row: { id: r.id ?? p.match(NOTICE_FILE)[1], fields: r.fields } };
  });
}

/** 各 notice を最初に足した commit(ref の履歴、done/ への移動は最も古い追加)。id → { commit, path } */
function addCommits(g, ref) {
  const out = new Map();
  const log = g.git(["log", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", ref, "--", ".notices/"]);
  let cur = null;
  for (const line of log.split("\n")) {
    if (line.startsWith("@")) cur = line.slice(1);
    else {
      const m = line.match(NOTICE_FILE);
      if (m && cur) out.set(m[1], { commit: cur, path: line }); // 新しい順 → 最後 = 最も古い
    }
  }
  return out;
}

// 1 つの版の名前: repo.json の repo_id を先に、無ければ古い形の project.md の fork_id:(forkIds.mjs の forkIdOfTexts と同じ規則。
// このファイルは自己完結なので写しを持つ)
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function forkIdOf(repoJson, projectMd) {
  if (repoJson !== null && repoJson !== undefined) {
    try {
      const v = JSON.parse(repoJson)?.repo_id;
      return typeof v === "string" && NAME_RE.test(v) ? v : null;
    } catch {
      return null;
    }
  }
  const lines = (projectMd ?? "").split("\n").filter((l) => /^fork_id:/.test(l));
  if (lines.length !== 1) return null;
  const v = lines[0].slice("fork_id:".length).trim().split(/\s+/)[0];
  return NAME_RE.test(v ?? "") ? v : null;
}

const readOrNull = (file) => (existsSync(file) ? readFileSync(file, "utf8") : null);

function remoteUrl(g, remote) {
  return remote ? normalizeUrl(g.tryGit(["remote", "get-url", remote]) ?? "") : "";
}

/** 本体: { tip, own, mid, source, segments, warnings } を返す。止まる時は Stop を投げる */
export function incoming(repo, { upstream, from = "index" }) {
  const g = makeGit(repo);
  if (!upstream) throw new Stop("--upstream=<remote>/<branch> が無い");
  if (g.git(["rev-parse", "--is-shallow-repository"]).trim() === "true") throw new Stop("浅い clone: 履歴を辿れない(git fetch --unshallow <upstream> の後にもう一度)");
  const tip = g.tryGit(["rev-parse", "--verify", "-q", `${upstream}^{commit}`])?.trim();
  if (!tip) throw new Stop(`${upstream} が無い(fetch の後にもう一度)`);
  const own = forkIdOf(readOrNull(join(repo, "repo.json")), readOrNull(join(repo, ".claude/rules/project.md")));
  if (!own) throw new Stop("repo.json の repo_id が読めない(古い形なら .claude/rules/project.md の fork_id:)");
  // 上流の先端の版の名前(repo.json を先に、無ければ古い形の project.md)
  const mid = forkIdOf(g.tryGit(["show", `${tip}:repo.json`]), g.tryGit(["show", `${tip}:.claude/rules/project.md`]));
  const midIsTier = Boolean(mid && g.tryGit(["cat-file", "-e", `${tip}:.notices/applied/${mid}.md`]) !== null);
  const warnings = [];

  let rows;
  if (from === "bodies") {
    rows = bodyRows(g, tip, { own, mid: mid ?? "(upstream)", originUrl: remoteUrl(g, "origin"), upstreamUrl: remoteUrl(g, upstream.split("/")[0]) });
  } else {
    rows = indexRows(g, tip);
    if (!rows.length) throw new Stop(`${upstream} の先端に索引 .notices/shipped/ が無い(今の手順で進める)`, 3);
  }
  const rowById = new Map(rows.map((r) => [r.row.id, r]));
  const skipped = new Set(rows.flatMap((r) => list(r.row.fields.skip_checkpoint)));

  // 継承済み = fork 成立点の索引の行 ∪ その木の notice(索引導入前に成立した fork のため両方)
  const first = (g.tryGit(["rev-list", "--reverse", "HEAD", `^${tip}`]) ?? "").split("\n").find(Boolean);
  const forkPoint = !first ? "HEAD" : g.tryGit(["rev-parse", "--verify", "-q", `${first}^`]) ? `${first}^` : first;
  const inherited = new Set([...treeNoticeIds(g, forkPoint), ...indexRows(g, forkPoint).map((r) => r.row.id)]);
  const ledger = new Set([...(g.tryGit(["show", `HEAD:.notices/applied/${own}.md`]) ?? "").matchAll(/^- id:(\S+)/gm)].map((m) => m[1]));
  const applied = (id) => inherited.has(id) || ledger.has(id);

  const adds = addCommits(g, tip);
  const order = g.git(["rev-list", "--reverse", "--topo-order", tip]).split("\n").filter(Boolean);
  const pos = new Map(order.map((sha, i) => [sha, i]));
  const at = (id) => pos.get(adds.get(id)?.commit) ?? Number.MAX_SAFE_INTEGER;
  // covers 索引: covered id → covers 側 id(履歴上最も早い covers 側)
  const coverOf = new Map();
  for (const r of [...rows].sort((x, y) => at(x.row.id) - at(y.row.id))) for (const c of list(r.row.fields.covers)) if (!coverOf.has(c)) coverOf.set(c, r.row.id);

  const pending = rows.filter((r) => r.owner !== own && !applied(r.row.id) && !(coverOf.has(r.row.id) && applied(coverOf.get(r.row.id))));

  const items = [];
  for (const { owner, row } of pending) {
    const add = adds.get(row.id);
    if (!add) throw new Stop(`${row.id}: 索引に行があるのに ${upstream} の履歴に足した commit が無い(履歴の書き換えか索引の食い違い)`);
    let point = add.commit;
    const grand = owner !== mid && owner !== own && midIsTier;
    if (grand) {
      const rec = (g.tryGit(["log", "--reverse", `-Sid:${row.id}`, "--format=%H", tip, "--", `.notices/applied/${mid}.md`]) ?? "").split("\n").find(Boolean);
      if (rec) point = rec;
      else warnings.push(`${row.id}: 中間 Tier ${mid} が未適用: 足した commit で区切る`);
    }
    if (!g.isAncestor(point, tip)) throw new Stop(`${row.id}: 区切り点 ${point.slice(0, 8)} が ${upstream} の祖先でない(上流の履歴の書き換え)`);
    items.push({ id: row.id, owner, grandparent: grand, point, add: add.commit, body: `${add.commit}:${add.path}`, fields: row.fields, break: isBreak(row, skipped), skipCheckpoint: skipped.has(row.id), inTree: g.isAncestor(point, "HEAD") });
  }

  // covered はその covers 側の区間に入る(covers 側が未適用で並ぶとき)。covers 側がまだ届いていなければ通常の notice
  const itemIds = new Set(items.map((i) => i.id));
  const riding = new Map();
  const main = [];
  for (const it of items) {
    const side = coverOf.get(it.id);
    if (side && side !== it.id && itemIds.has(side)) riding.set(side, [...(riding.get(side) ?? []), it.id]);
    else main.push(it);
  }
  main.sort((a, b) => (pos.get(a.point) ?? -1) - (pos.get(b.point) ?? -1) || (a.id < b.id ? -1 : 1));
  const withCovered = (it) => ({ ...it, covered: (riding.get(it.id) ?? []).sort() });

  const segments = [];
  const zero = main.filter((i) => i.inTree).map(withCovered);
  if (zero.length) segments.push({ n: 0, target: null, label: "tree", notices: zero });
  let cur = [];
  let last = "HEAD";
  for (const it of main.filter((i) => !i.inTree)) {
    cur.push(withCovered(it));
    if (it.break) {
      segments.push({ n: segments.length + (zero.length ? 0 : 1), target: it.point, label: it.fields.checkpoint && it.fields.checkpoint !== "-" ? it.fields.checkpoint : it.id, notices: cur });
      last = it.point;
      cur = [];
    }
  }
  const restCommits = Number(g.git(["rev-list", "--count", `${last}..${tip}`, "^HEAD"]).trim());
  if (cur.length || restCommits > 0) segments.push({ n: segments.length + (zero.length ? 0 : 1), target: tip, label: "HEAD", tail: true, notices: cur });
  // 脇の commit の区間: 前の位置(最初 = HEAD と先端の merge-base、以降 = 前の区間の merge 先)が merge 先の祖先でない
  // (修正を壊れた地点の脇の commit で出して merge した形で、その修正を取らなかった fork)。merge すると上流との merge-base が 2 つになる
  let prev = (g.tryGit(["merge-base", "HEAD", tip]) ?? "").trim() || null;
  for (const s of segments) {
    if (!s.target) continue;
    if (prev && !g.isAncestor(prev, s.target)) {
      s.offLine = true;
      s.mainline = (g.tryGit(["rev-list", "--first-parent", "--ancestry-path", `${s.target}..${tip}`]) ?? "").split("\n").filter(Boolean).pop() ?? null;
    }
    prev = s.target;
  }
  return { tip, own, mid, midIsTier, source: from, forkPoint, segments, warnings };
}

/** 比べやすい形(区間ごとの merge 先と notice の id、covered) */
export function summary(result) {
  return result.segments.map((s) => `${s.n}:${s.target ? s.target.slice(0, 8) : "tree"}:${s.notices.map((n) => n.id + (n.covered.length ? `[${n.covered.join(",")}]` : "")).join(",")}`);
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const upstream = argv.find((a) => a.startsWith("--upstream="))?.slice(11);
  const from = argv.find((a) => a.startsWith("--from="))?.slice(7) ?? "index";
  try {
    const r = incoming(repo, { upstream, from });
    if (argv.includes("--json")) {
      log(JSON.stringify(r, null, 2));
      return 0;
    }
    log(`incoming: ${upstream} ${r.tip.slice(0, 8)} / 自分 ${r.own} / 直上 ${r.mid ?? "-"}${r.midIsTier ? "(中間 Tier)" : ""} / 継承の基準 ${r.forkPoint === "HEAD" ? "HEAD" : r.forkPoint.slice(0, 8)} / 元 ${r.source}`);
    if (!r.segments.length) log("incoming: 取り込むものなし");
    for (const s of r.segments) {
      const ids = s.notices.map((n) => `${n.id}${n.grandparent ? "(祖父)" : ""}${n.skipCheckpoint ? "(区切りを外された)" : ""}${n.covered.length ? ` covers ${n.covered.join(", ")}` : ""}`);
      log(`区間 ${s.n} → ${s.target ? s.target.slice(0, 8) : "merge なし"} ${s.label}: ${ids.join(" / ") || "(notice なし、merge のみ)"}`);
      if (s.offLine) log(`  脇の commit: merge 先が前の位置の子孫でない(merge すると上流との merge-base が 2 つになる)。本線で含む commit ${s.mainline ? s.mainline.slice(0, 8) : "-"}。merge せず止まる(SKILL.md 手順 5a)`);
    }
    for (const w of r.warnings) log(`警告: ${w}`);
    return 0;
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    log(`incoming: ${e.code === 3 ? "" : "止まる — "}${e.message}`);
    return e.code;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = run(process.cwd(), process.argv.slice(2));
