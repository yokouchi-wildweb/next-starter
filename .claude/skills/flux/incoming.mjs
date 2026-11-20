// .claude/skills/flux/incoming.mjs — /flux の流入の発見と区間の組み立て(手順 SKILL.md「UNAPPLIED JUDGMENT」「BUILDING SEGMENTS」、多段 relay.md)
// 上流の先端の履歴だけで決める(索引は持たない、D350): お知らせの一覧 = 先端の履歴で .notices/(done/ も)に足された本文の全部
// (merge で足された本文も、改名の前の名前は除く)。欄はその本文の最後の版(先端の木に有ればその版、消えていれば消す 1 つ前の版)から、
// 持ち主は本文の from:(own / 直上 / 祖父)。本文は区間が閉じたら消してよい(最後の版は履歴に残る)。
//
// 自己完結(このファイルの外を import しない): /flux は手順書と付属ファイルを上流の先端の版で読むので、
//   git show <upstream>/<branch>:.claude/skills/flux/incoming.mjs > <一時ファイル> && node <一時ファイル> --upstream=<upstream>/<branch>
// で、scripts/workflow/notices がまだ届いていない遅れた fork でも先端の判定で動く(cwd = fork のリポ)。
//
// 実行: node .claude/skills/flux/incoming.mjs --upstream=<remote>/<branch> [--json]
//   未適用 = 先端の一覧 − 持ち主が自分の物 − 継承済み(fork 成立点の履歴に足された本文 ∪ その木の .notices)− 自分の台帳
//            − covers 側が適用済みの covered
//   区切り点 = 直接の親の物は本文の checkpoint_at:(足した commit の子孫・次のお知らせの点より前・先端の祖先の時だけ、外れたら警告)
//            か notice を足した commit、祖父の物は直上 Tier の台帳にその id が載った commit(無ければ足した commit + 警告)
//   区切り = 欄 checkpoint がラベルか欄なし。ただし先端のどれかの本文の skip_checkpoint: <id> に名指された物は - とみなす
//   区間 0 = 区切り点が HEAD の祖先。以降は区切り点の履歴順に、区切りの直後で閉じる。最後の区切り以降 + 残りの commit = 末尾区間
//   offLine = 前の位置(HEAD と先端の merge-base / 前の区間の merge 先)が merge 先の祖先でない区間(脇の commit。mainline = 本線でそれを含む最初の commit)
//   Rejoin パターン(patterns.md) = 区切りのある 2 本の線が 1 つの merge で合わさる形: 多い線の区間を先に 1 つずつ、少ない線は合流の
//            merge を目標の区間 1 つに(区間に pattern:"Rejoin"、合流の区間は rejoinMerge)。決めない形は rejoin:{ undecided, why, merge }
//   body = 本文を読む場所(最後の版: <先端>:<パス> か <消した commit>^:<パス>)
//   exit 0 = 出した | 2 = 止まる(浅い clone・区切り点が先端の祖先でない・repo_id が無い)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const NOTICE_FILE = /^\.notices\/(?:done\/)?(\d{8}-\d{6}-[^/]+)\.md$/;
const ROW_KEYS = ["severity", "checkpoint", "checkpoint_at", "covers", "moved", "fixes", "resolves", "hotfix", "uses", "pick", "skip_checkpoint"];

class Stop extends Error {
  constructor(message, code = 2) {
    super(message);
    this.code = code;
  }
}

/** 「- id:<id> | key:value …」の 1 行 → { id, fields }(古い索引の行の形。比べる用)。行でなければ null */
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

/** notice 本文 → { id, fields(一覧の欄), from } */
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
  return { git, tryGit, isAncestor, repo };
}

/** ref の木の notice の id(直下と done/) */
function treeNoticeIds(g, ref) {
  return (g.tryGit(["ls-tree", "-r", "--name-only", ref, "--", ".notices/"]) ?? "")
    .split("\n")
    .map((p) => p.match(NOTICE_FILE)?.[1])
    .filter(Boolean);
}

/** ref の木の notice: id → パス(直下と done/) */
function treeNoticePaths(g, ref) {
  const out = new Map();
  for (const p of (g.tryGit(["ls-tree", "-r", "--name-only", ref, "--", ".notices/"]) ?? "").split("\n")) {
    const m = p.match(NOTICE_FILE);
    if (m) out.set(m[1], p);
  }
  return out;
}

/** git log の「@<sha>」と名前の並び → [{ commit, line }](新しい順) */
function logNames(g, args) {
  const out = [];
  let cur = null;
  for (const line of (g.tryGit(args) ?? "").split("\n")) {
    if (line.startsWith("@")) cur = line.slice(1);
    else if (line && cur) out.push({ commit: cur, line });
  }
  return out;
}

/**
 * ref の履歴で .notices/ に足された本文: id → { commit, path }(最初に足した commit。done/ への移動は最も古い追加)。
 * merge でない足しが無い本文は merge で足した物(中の段の relay の本文: 「AA」)を -m で探す。改名の前の名前は入れない
 */
function addCommits(g, ref) {
  const out = new Map();
  for (const { commit, line } of logNames(g, ["log", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", ref, "--", ".notices/"])) {
    const m = line.match(NOTICE_FILE);
    if (m) out.set(m[1], { commit, path: line }); // 新しい順 → 最後 = 最も古い
  }
  for (const { commit, line } of logNames(g, ["log", "-m", "--merges", "--no-renames", "--diff-filter=A", "--name-only", "--format=@%H", ref, "--", ".notices/"])) {
    const m = line.match(NOTICE_FILE);
    if (m && (!out.has(m[1]) || out.get(m[1]).merge)) out.set(m[1], { commit, path: line, merge: true });
  }
  for (const { line } of logNames(g, ["log", "-M", "--diff-filter=R", "--name-status", "--format=@%H", ref, "--", ".notices/"])) {
    const [st, from, to] = line.split("\t");
    const a = from?.match(NOTICE_FILE)?.[1];
    const b = to?.match(NOTICE_FILE)?.[1];
    if (st?.startsWith("R") && a && b && a !== b) out.delete(a); // 改名: 前の名前の本文は新しい名前の物
  }
  return out;
}

/** 本文の最後の版の場所: 先端の木に有れば <tip>:<パス>、消えていれば <消した commit>^:<パス> */
function lastBodies(g, tip, adds) {
  const inTree = treeNoticePaths(g, tip);
  const deleted = new Map();
  for (const { commit, line } of logNames(g, ["log", "--no-renames", "--diff-filter=D", "--name-only", "--format=@%H", tip, "--", ".notices/"])) {
    const m = line.match(NOTICE_FILE);
    if (m && !deleted.has(m[1])) deleted.set(m[1], `${commit}^:${line}`); // 新しい順 → 最初 = 最後に消した
  }
  const out = new Map();
  for (const [id, add] of adds) out.set(id, inTree.has(id) ? `${tip}:${inTree.get(id)}` : deleted.get(id) ?? `${add.commit}:${add.path}`);
  return out;
}

/** 本文をまとめて読む(git cat-file --batch): 場所 → 中身 */
function readBodies(g, specs) {
  const out = new Map();
  if (!specs.length) return out;
  const buf = execFileSync("git", ["-C", g.repo, "cat-file", "--batch"], { input: specs.join("\n") + "\n", maxBuffer: 512 * 1024 * 1024 });
  let at = 0;
  for (const spec of specs) {
    const nl = buf.indexOf(10, at);
    const head = buf.subarray(at, nl).toString("utf8");
    at = nl + 1;
    const m = head.match(/^\S+ blob (\d+)$/);
    if (!m) continue; // missing
    const n = Number(m[1]);
    out.set(spec, buf.subarray(at, at + n).toString("utf8"));
    at += n + 1;
  }
  return out;
}

/** repo の ref の履歴の一覧(ほかの読み手・比べる用): [{ owner, id, fields, add, body }] */
export function historyList(repo, ref, { own = "(own)", mid = "(upstream)", originUrl = null, upstreamUrl = null } = {}) {
  return historyRows(makeGit(repo), ref, { own, mid, originUrl, upstreamUrl }).map((r) => ({ owner: r.owner, id: r.row.id, fields: r.row.fields, add: r.add, body: r.body }));
}

/** 先端の履歴の一覧: [{ owner, row, add, body }]。owner は本文の from: の URL で own / 直上 / 祖父 に分ける */
function historyRows(g, tip, { own, mid, originUrl, upstreamUrl }) {
  const adds = addCommits(g, tip);
  const last = lastBodies(g, tip, adds);
  const texts = readBodies(g, [...new Set(last.values())]);
  const out = [];
  for (const [id, add] of adds) {
    const text = texts.get(last.get(id));
    if (text === undefined) continue;
    const r = rowFromBody(text);
    // from: is the repo's URL, or (older relay bodies) its name: 「next-starter (tier1 upstream)」
    const repoUrl = normalizeUrl((r.from.match(/^(\S+)/) ?? ["", ""])[1].replace(/[|,].*$/, ""));
    const name = repoUrl.split("/").pop();
    const owner = (originUrl && repoUrl === originUrl) || name === own ? own : !upstreamUrl || repoUrl === upstreamUrl || !repoUrl || name === mid ? mid : `grandparent:${repoUrl}`;
    out.push({ owner, row: { id, fields: r.fields }, add, body: last.get(id) });
  }
  return out;
}

// 1 つの版の名前: repo.json の repo_id を先に、無ければ古い形の project.md の fork_id:(forkIds.mjs の forkIdOfTexts と同じ規則。
// このファイルは自己完結なので写しを持つ。同じ答えになることは incoming.test.mjs が forkIdOfTexts と照らして縛る)
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function forkIdOf(repoJson, projectMd) {
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

// Rejoin パターン(.claude/skills/flux/patterns.md): 上流の履歴が 2 本の線に分かれ、1 つの merge で合わさり、両方の線に区切りがある形。
// 区切りの多い線の区間を 1 つずつ先に(その線の上の区切り点)、少ない線の notice は独立の区間にせず、合流の merge を目標にする
// 区間 1 つにまとめる(merge すれば少ない線が丸ごと入る)。決めない形(同じ数・3 本以上の線や重なった合流・片側の notice の
// fixes / covers / uses / skip_checkpoint が他の側の notice を名指す)は印だけ付けて今の並び(履歴の順)のまま。
// 線の区切りの数・持ち主・名指しは merge 全体(all: fork が取り込み済みの区切りも)で読み、並べ直すのは残り(items)だけ:
// 長い線の一部を取った後に残りだけで数えると「同じ数」になって止まった(区間 301 の後、計画書 14 S3)
const NAMING = ["fixes", "covers", "uses", "skip_checkpoint"];
/** 区切り点の並び(items、履歴の順)を Rejoin で並べ直す。items の各物に rejoin: { merge, joined? | more? | undecided?, why? }。
 * all = items を含む全部の区切り点(省くと items) */
export function rejoin(g, items, { base, tip, all: everything = items }) {
  if (!base || !items.length) return items;
  const merges = (g.tryGit(["rev-list", "--reverse", "--first-parent", "--merges", `${base}..${tip}`]) ?? "").split("\n").filter(Boolean);
  let out = [...items];
  const taken = new Set();
  for (const m of merges) {
    const parents = g.git(["rev-list", "--parents", "-n", "1", m]).trim().split(/\s+/).slice(1);
    const mb = (g.tryGit(["merge-base", "--octopus", ...parents]) ?? "").trim();
    if (!mb) continue;
    const sides = parents.map((p) => new Set((g.tryGit(["rev-list", `${mb}..${p}`]) ?? "").split("\n").filter(Boolean)));
    const on = sides.map((s) => out.filter((it) => s.has(it.point)));
    const whole = sides.map((s) => everything.filter((it) => s.has(it.point)));
    if (whole.filter((s) => s.some((it) => it.break)).length < 2) continue;
    if (!on.some((s) => s.length)) continue;   // 全部取り込み済み: 並べ直す物が無い
    // 1 つの版の中の分かれだけ(全部が同じ持ち主の行で、祖父の行が無い)。中間 Tier が上流を merge した形(片側が中間 Tier の
    // 行、片側が祖父の行)は普段の取り込みで Rejoin ではない
    const owners = new Set(whole.flat().map((it) => it.owner));
    if (owners.size !== 1 || whole.flat().some((it) => it.grandparent)) continue;
    const all = on.flat();
    const mark = (why) => {
      for (const it of all) it.rejoin = { merge: m, undecided: true, why };
      for (const it of all) taken.add(it.id);
    };
    if (parents.length > 2) { mark("3 本以上の線"); continue; }
    if (all.some((it) => taken.has(it.id))) { mark("重なった合流(3 本以上の線)"); continue; }
    const counts = whole.map((s) => s.filter((it) => it.break).length);
    if (counts[0] === counts[1]) { mark(`区切りが同じ数(${counts[0]})`); continue; }
    const ids = whole.map((s) => new Set(s.map((it) => it.id)));
    const binds = whole.some((s, k) => s.some((it) => NAMING.some((f) => list(it.fields[f]).some((x) => ids[1 - k].has(x)))));
    if (binds) { mark("片側の notice が他の側の notice を名指す(順が縛られる)"); continue; }
    const more = counts[0] > counts[1] ? 0 : 1;
    const a = on[more].map((it) => ({ ...it, rejoin: { merge: m, more: true } }));
    const b = on[1 - more].map((it, i, arr) => (i === arr.length - 1 ? { ...it, break: true, point: m, rejoin: { merge: m, joined: true } } : { ...it, break: false, rejoin: { merge: m, joined: true } }));
    const block = new Set(all.map((it) => it.id));
    const at = out.findIndex((it) => block.has(it.id));
    out = [...out.slice(0, at).filter((it) => !block.has(it.id)), ...a, ...b, ...out.slice(at).filter((it) => !block.has(it.id))];
    for (const id of block) taken.add(id);
  }
  return out;
}

/** 本体: { tip, own, mid, source, segments, warnings } を返す。止まる時は Stop を投げる */
export function incoming(repo, { upstream }) {
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

  const rows = historyRows(g, tip, { own, mid: mid ?? "(upstream)", originUrl: remoteUrl(g, "origin"), upstreamUrl: remoteUrl(g, upstream.split("/")[0]) });
  const rowById = new Map(rows.map((r) => [r.row.id, r]));
  const skipped = new Set(rows.flatMap((r) => list(r.row.fields.skip_checkpoint)));

  // 継承済み = fork 成立点の履歴に足された本文 ∪ その木の notice
  const first = (g.tryGit(["rev-list", "--reverse", "HEAD", `^${tip}`]) ?? "").split("\n").find(Boolean);
  const forkPoint = !first ? "HEAD" : g.tryGit(["rev-parse", "--verify", "-q", `${first}^`]) ? `${first}^` : first;
  const inherited = new Set([...treeNoticeIds(g, forkPoint), ...addCommits(g, forkPoint).keys()]);
  const ledger = new Set([...(g.tryGit(["show", `HEAD:.notices/applied/${own}.md`]) ?? "").matchAll(/^- id:(\S+)/gm)].map((m) => m[1]));
  const applied = (id) => inherited.has(id) || ledger.has(id);

  const adds = new Map(rows.map((r) => [r.row.id, r.add]));
  const bodyOf = new Map(rows.map((r) => [r.row.id, r.body]));
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
    let point = add.commit;
    const grand = owner !== mid && owner !== own && midIsTier;
    if (grand) {
      const rec = (g.tryGit(["log", "--reverse", `-Sid:${row.id}`, "--format=%H", tip, "--", `.notices/applied/${mid}.md`]) ?? "").split("\n").find(Boolean);
      if (rec) point = rec;
      else warnings.push(`${row.id}: 中間 Tier ${mid} が未適用: 足した commit で区切る`);
    } else if (row.fields.checkpoint_at && row.fields.checkpoint_at !== "-") {
      // 本文が足した後に直された区切り(D353): 足した commit の子孫・次のお知らせの足しより前・先端の祖先の時だけ採る
      const cp = g.tryGit(["rev-parse", "--verify", "-q", `${row.fields.checkpoint_at}^{commit}`])?.trim();
      const nextAt = Math.min(...[...adds.values()].map((a) => pos.get(a.commit) ?? Number.MAX_SAFE_INTEGER).filter((p) => p > (pos.get(add.commit) ?? -1)), Number.MAX_SAFE_INTEGER);
      if (cp && g.isAncestor(add.commit, cp) && g.isAncestor(cp, tip) && (pos.get(cp) ?? Number.MAX_SAFE_INTEGER) < nextAt) point = cp;
      else warnings.push(`${row.id}: checkpoint_at: ${row.fields.checkpoint_at} を採らない(足した commit の子孫・次のお知らせより前・先端の祖先でない): 足した commit で区切る`);
    }
    if (!g.isAncestor(point, tip)) throw new Stop(`${row.id}: 区切り点 ${point.slice(0, 8)} が ${upstream} の祖先でない(上流の履歴の書き換え)`);
    items.push({ id: row.id, owner, grandparent: grand, point, add: add.commit, body: bodyOf.get(row.id), fields: row.fields, break: isBreak(row, skipped), skipCheckpoint: skipped.has(row.id), inTree: g.isAncestor(point, "HEAD") });
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
  const base0 = (g.tryGit(["merge-base", "HEAD", tip]) ?? "").trim() || null;
  // Rejoin の数は merge 全体で(取り込み済み = 継承・台帳の upstream の行も、足した commit を区切り点に)
  const taken0 = rows.filter((r) => r.owner !== own && !itemIds.has(r.row.id) && adds.get(r.row.id)).map((r) => ({
    id: r.row.id, owner: r.owner, grandparent: r.owner !== mid && midIsTier, point: adds.get(r.row.id).commit, fields: r.row.fields, break: isBreak(r.row, skipped),
  }));
  const ordered = rejoin(g, main.filter((i) => !i.inTree), { base: base0, tip, rowById, all: [...main, ...taken0] });
  const withCovered = (it) => ({ ...it, covered: (riding.get(it.id) ?? []).sort() });

  const segments = [];
  const zero = main.filter((i) => i.inTree).map(withCovered);
  if (zero.length) segments.push({ n: 0, target: null, label: "tree", notices: zero });
  let cur = [];
  let last = "HEAD";
  for (const it of ordered) {
    cur.push(withCovered(it));
    if (it.break) {
      const s = { n: segments.length + (zero.length ? 0 : 1), target: it.point, label: it.fields.checkpoint && it.fields.checkpoint !== "-" ? it.fields.checkpoint : it.id, notices: cur };
      if (cur.some((c) => c.rejoin)) {
        // Rejoin パターン(patterns.md): 合流の区間・多い側の区間、または決めない印(どれか 1 つでも決めない側なら決めない)
        const u = cur.find((c) => c.rejoin?.undecided);
        s.pattern = "Rejoin";
        if (u) s.rejoin = { undecided: true, why: u.rejoin.why, merge: u.rejoin.merge };
        else if (cur.some((c) => c.rejoin.joined)) s.rejoinMerge = it.point;
      }
      segments.push(s);
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
  return { tip, own, mid, midIsTier, forkPoint, segments, warnings };
}

/** 比べやすい形(区間ごとの merge 先と notice の id、covered) */
export function summary(result) {
  return result.segments.map((s) => `${s.n}:${s.target ? s.target.slice(0, 8) : "tree"}:${s.notices.map((n) => n.id + (n.covered.length ? `[${n.covered.join(",")}]` : "")).join(",")}`);
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const upstream = argv.find((a) => a.startsWith("--upstream="))?.slice(11);
  try {
    const r = incoming(repo, { upstream });
    if (argv.includes("--json")) {
      log(JSON.stringify(r, null, 2));
      return 0;
    }
    log(`incoming: ${upstream} ${r.tip.slice(0, 8)} / 自分 ${r.own} / 直上 ${r.mid ?? "-"}${r.midIsTier ? "(中間 Tier)" : ""} / 継承の基準 ${r.forkPoint === "HEAD" ? "HEAD" : r.forkPoint.slice(0, 8)}`);
    if (!r.segments.length) log("incoming: 取り込むものなし");
    for (const s of r.segments) {
      const ids = s.notices.map((n) => `${n.id}${n.grandparent ? "(祖父)" : ""}${n.skipCheckpoint ? "(区切りを外された)" : ""}${n.covered.length ? ` covers ${n.covered.join(", ")}` : ""}`);
      log(`区間 ${s.n} → ${s.target ? s.target.slice(0, 8) : "merge なし"} ${s.label}: ${ids.join(" / ") || "(notice なし、merge のみ)"}`);
      if (s.pattern === "Rejoin") log(s.rejoin?.undecided ? `  Rejoin パターン(決めない: ${s.rejoin.why}、合流 ${s.rejoin.merge.slice(0, 8)}): 並べ替えず止まって聞く(patterns.md)` : s.rejoinMerge ? `  Rejoin パターン: 少ない側の線を合流の merge ${s.rejoinMerge.slice(0, 8)} で取る` : "  Rejoin パターン: 区切りの多い側の線を 1 つずつ先に");
      if (s.offLine) log(`  脇の commit: merge 先が前の位置の子孫でない(merge すると上流との merge-base が 2 つになる)。本線で含む commit ${s.mainline ? s.mainline.slice(0, 8) : "-"}。merge せず止まる(SKILL.md 手順 5a)`);
    }
    for (const w of r.warnings) log(`警告: ${w}`);
    return 0;
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    log(`incoming: 止まる — ${e.message}`);
    return e.code;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = run(process.cwd(), process.argv.slice(2));
