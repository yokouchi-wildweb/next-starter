// .claude/skills/flux/incoming.mjs — /flux の流入の発見と区間の組み立て(手順 SKILL.md「UNAPPLIED JUDGMENT」「BUILDING SEGMENTS」、多段 relay.md)
// 上流の先端の履歴だけで決める(索引は持たない、D350): お知らせの一覧 = 先端の履歴で .notices/(done/ も)に足された本文の全部
// (merge で足された本文も、改名の前の名前は除く)。欄はその本文の最後の版(先端の木に有ればその版、消えていれば消す 1 つ前の版)から、
// 持ち主は本文の from:(own / 直上 / 祖父)。本文は区間が閉じたら消してよい(最後の版は履歴に残る)。
//
// 自己完結(このファイルの外を import しない): /flux は手順書と付属ファイルを上流の先端の版で読むので、
//   git show <upstream>/<branch>:.claude/skills/flux/incoming.mjs > <一時ファイル> && node <一時ファイル> --upstream=<upstream>/<branch>
// で、scripts/workflow/notices がまだ届いていない遅れた fork でも先端の判定で動く(cwd = fork のリポ)。
//
// 実行: node .claude/skills/flux/incoming.mjs --upstream=<remote>/<branch> [--own=<repo_id>] [--json]
//   --own = 自分の名前を外から渡す(作業ツリーの repo.json / project.md より先)。作業ツリーの repo.json が自分の名前でない
//            作業場所(鉄道の敷設の track: 上流の取り込みの並びで repo.json が上流の値)で、自分を上流と読んで区間が 1 つになる
//            (Summit 線 11-21)のを避ける
//   未適用 = 先端の一覧 − 持ち主が自分の物 − 継承済み(fork 成立点の履歴に足された本文 ∪ その木の .notices)− 自分の台帳
//            − covers 側が適用済みの covered
//   区切り点 = 直接の親の物は本文の checkpoint_at:(足した commit の子孫・次のお知らせの点より前・先端の祖先の時だけ、外れたら警告)
//            か notice を足した commit、祖父の物は直上 Tier の台帳にその id が載った commit(無ければ足した commit + 警告)
//   区切り = 欄 checkpoint がラベルか欄なし。ただし先端のどれかの本文の skip_checkpoint: <id> に名指された物は - とみなす
//   区間 0 = 区切り点が HEAD の祖先。以降は区切り点の履歴順に、区切りの直後で閉じる。最後の区切り以降 + 残りの commit = 末尾区間
//   offLine = 前の位置(HEAD と先端の merge-base / 前の区間の merge 先)が merge 先の祖先でない区間(脇の commit。mainline = 本線でそれを含む最初の commit)
//   joins = 上流の first-parent の merge のうち、未適用の区切りが 2 つ以上の側にある物(事実だけ、並べ替えない: 順は取り込む側が
//            決める、D473): merge・parents・側ごとの未適用の notice(id・point・break)・他の側の notice を名指す欄(naming)。
//            その側の notice を持つ区間に pattern:"join" と join:<merge>
//   owner_by = 持ち主の根拠: url(from: の URL が origin / 直上と一致、祖父はその URL)/ name(名前の一致)/ none(空の from:、直上の
//            URL が読めない: 直上に寄せた)。from = 本文の生の from:
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

/** repo の ref の履歴の一覧(ほかの読み手・比べる用): [{ owner, owner_by, from, id, fields, add, body }] */
export function historyList(repo, ref, { own = "(own)", mid = "(upstream)", originUrl = null, upstreamUrl = null } = {}) {
  return historyRows(makeGit(repo), ref, { own, mid, originUrl, upstreamUrl }).map((r) => ({ owner: r.owner, owner_by: r.ownerBy, from: r.from, id: r.row.id, fields: r.row.fields, add: r.add, body: r.body }));
}

/** 持ち主と根拠: [owner, owner_by]。URL の一致が答え(url)、名前の一致(name)・空の from: や直上の URL が無い時の直上への寄せ(none)は見当 */
export function ownerOf({ repoUrl, name, own, mid, originUrl, upstreamUrl }) {
  if (originUrl && repoUrl === originUrl) return [own, "url"];
  if (name === own) return [own, "name"];
  if (upstreamUrl && repoUrl && repoUrl === upstreamUrl) return [mid, "url"];
  if (!upstreamUrl || !repoUrl) return [mid, "none"];
  if (name === mid) return [mid, "name"];
  return [`grandparent:${repoUrl}`, "url"];
}

/** 先端の履歴の一覧: [{ owner, ownerBy, from, row, add, body }]。owner は本文の from: の URL で own / 直上 / 祖父 に分ける */
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
    const [owner, ownerBy] = ownerOf({ repoUrl, name, own, mid, originUrl, upstreamUrl });
    out.push({ owner, ownerBy, from: r.from, row: { id, fields: r.fields }, add, body: last.get(id) });
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

// 分かれた線の合流の事実(D473: 並べ替えない、順は取り込む側が決める)。上流の first-parent の merge ごとに、各側(merge-base から
// その親まで)に乗る未適用の notice を数え、区切りのある側が 2 つ以上の時だけ出す。1 つの版の中の分かれだけ(全部が同じ持ち主で
// 祖父の行が無い): 中間 Tier が上流を merge した形(片側が中間 Tier の行、片側が祖父の行)は普段の取り込みで合流ではない。
// naming = ある側の notice の欄(fixes / covers / uses / skip_checkpoint)が他の側の notice を名指す物(順を縛る事実)
const NAMING = ["fixes", "covers", "uses", "skip_checkpoint"];
/** items = 未適用の区切り点(fork の木に無い物)、all = 名指しを読む全部の未適用 → [{ merge, parents, sides, naming }] */
export function joinsOf(g, items, { base, tip, all = items }) {
  if (!base || !items.length) return [];
  const merges = (g.tryGit(["rev-list", "--reverse", "--first-parent", "--merges", `${base}..${tip}`]) ?? "").split("\n").filter(Boolean);
  const out = [];
  for (const m of merges) {
    const parents = g.git(["rev-list", "--parents", "-n", "1", m]).trim().split(/\s+/).slice(1);
    const mb = (g.tryGit(["merge-base", "--octopus", ...parents]) ?? "").trim();
    if (!mb) continue;
    const sides = parents.map((p) => new Set((g.tryGit(["rev-list", `${mb}..${p}`]) ?? "").split("\n").filter(Boolean)));
    const on = sides.map((s) => items.filter((it) => s.has(it.point)));
    if (on.filter((s) => s.some((it) => it.break)).length < 2) continue;
    const owners = new Set(on.flat().map((it) => it.owner));
    if (owners.size !== 1 || on.flat().some((it) => it.grandparent)) continue;
    const ids = sides.map((s) => new Set(all.filter((it) => s.has(it.point)).map((it) => it.id)));
    const naming = [];
    on.forEach((side, k) => {
      for (const it of side) {
        for (const field of NAMING) {
          const names = list(it.fields[field]).filter((x) => ids.some((set, j) => j !== k && set.has(x)));
          if (names.length) naming.push({ id: it.id, field, names });
        }
      }
    });
    out.push({ merge: m, parents, sides: parents.map((parent, k) => ({ parent, notices: on[k].map((it) => ({ id: it.id, point: it.point, break: it.break })) })), naming });
  }
  return out;
}

/** 本体: { tip, own, mid, source, segments, warnings } を返す。止まる時は Stop を投げる */
export function incoming(repo, { upstream, own: ownArg }) {
  const g = makeGit(repo);
  if (!upstream) throw new Stop("--upstream=<remote>/<branch> が無い");
  if (g.git(["rev-parse", "--is-shallow-repository"]).trim() === "true") throw new Stop("浅い clone: 履歴を辿れない(git fetch --unshallow <upstream> の後にもう一度)");
  const tip = g.tryGit(["rev-parse", "--verify", "-q", `${upstream}^{commit}`])?.trim();
  if (!tip) throw new Stop(`${upstream} が無い(fetch の後にもう一度)`);
  if (ownArg !== undefined && !NAME_RE.test(ownArg)) throw new Stop(`--own=${ownArg} は repo_id の形でない(小文字・数字・ハイフン)`);
  const own = ownArg ?? forkIdOf(readOrNull(join(repo, "repo.json")), readOrNull(join(repo, ".claude/rules/project.md")));
  if (!own) throw new Stop("repo.json の repo_id が読めない(古い形なら .claude/rules/project.md の fork_id:)");
  // 上流の先端の版の名前(repo.json を先に、無ければ古い形の project.md)
  const mid = forkIdOf(g.tryGit(["show", `${tip}:repo.json`]), g.tryGit(["show", `${tip}:.claude/rules/project.md`]));
  const midIsTier = Boolean(mid && g.tryGit(["cat-file", "-e", `${tip}:.notices/applied/${mid}.md`]) !== null);
  const warnings = [];

  const rows = historyRows(g, tip, { own, mid: mid ?? "(upstream)", originUrl: remoteUrl(g, "origin"), upstreamUrl: remoteUrl(g, upstream.split("/")[0]) });
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
  for (const { owner, ownerBy, from, row } of pending) {
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
    items.push({ id: row.id, owner, owner_by: ownerBy, from, grandparent: grand, point, add: add.commit, body: bodyOf.get(row.id), fields: row.fields, break: isBreak(row, skipped), skipCheckpoint: skipped.has(row.id), inTree: g.isAncestor(point, "HEAD") });
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
  // 区間は区切り点の履歴の順(並べ替えない)。分かれた線の合流は事実として joins に
  const ordered = main.filter((i) => !i.inTree);
  const joins = joinsOf(g, ordered, { base: base0, tip, all: main });
  const joinOf = new Map();
  for (const j of joins) for (const side of j.sides) for (const n of side.notices) if (!joinOf.has(n.id)) joinOf.set(n.id, j.merge);
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
      const j = cur.map((c) => joinOf.get(c.id)).find(Boolean);
      if (j) {
        s.pattern = "join";
        s.join = j;
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
  return { tip, own, mid, midIsTier, forkPoint, segments, joins, warnings };
}

/** 比べやすい形(区間ごとの merge 先と notice の id、covered) */
export function summary(result) {
  return result.segments.map((s) => `${s.n}:${s.target ? s.target.slice(0, 8) : "tree"}:${s.notices.map((n) => n.id + (n.covered.length ? `[${n.covered.join(",")}]` : "")).join(",")}`);
}

/** 本体(テストからは repo と log を渡す)。exit code を返す */
export function run(repo, argv, log = console.log) {
  const upstream = argv.find((a) => a.startsWith("--upstream="))?.slice(11);
  const own = argv.find((a) => a.startsWith("--own="))?.slice(6);
  try {
    const r = incoming(repo, { upstream, own });
    if (argv.includes("--json")) {
      log(JSON.stringify(r, null, 2));
      return 0;
    }
    log(`incoming: ${upstream} ${r.tip.slice(0, 8)} / 自分 ${r.own} / 直上 ${r.mid ?? "-"}${r.midIsTier ? "(中間 Tier)" : ""} / 継承の基準 ${r.forkPoint === "HEAD" ? "HEAD" : r.forkPoint.slice(0, 8)}`);
    if (!r.segments.length) log("incoming: 取り込むものなし");
    for (const s of r.segments) {
      const ids = s.notices.map((n) => `${n.id}${n.grandparent ? "(祖父)" : ""}${n.skipCheckpoint ? "(区切りを外された)" : ""}${n.covered.length ? ` covers ${n.covered.join(", ")}` : ""}`);
      log(`区間 ${s.n} → ${s.target ? s.target.slice(0, 8) : "merge なし"} ${s.label}: ${ids.join(" / ") || "(notice なし、merge のみ)"}`);
      if (s.join) log(`  合流 ${s.join.slice(0, 8)} の側の notice を持つ(joins)`);
      if (s.offLine) log(`  脇の commit: merge 先が前の位置の子孫でない(merge すると上流との merge-base が 2 つになる)。本線で含む commit ${s.mainline ? s.mainline.slice(0, 8) : "-"}。merge せず止まる(SKILL.md 手順 5a)`);
    }
    for (const j of r.joins) {
      const sides = j.sides.map((x) => x.notices.filter((n) => n.break).length).join(" / ");
      const naming = j.naming.map((x) => `${x.id} ${x.field}: ${x.names.join(", ")}`).join("; ");
      log(`合流 ${j.merge.slice(0, 8)}: 側ごとの未適用の区切り ${sides}${naming ? `、名指し ${naming}` : ""}。区間は履歴の順、取る順は取り込む側が決める`);
    }
    const guessed = r.segments.flatMap((s) => s.notices).filter((n) => n.owner_by !== "url");
    if (guessed.length) log(`持ち主の見当(owner_by が url でない): ${guessed.map((n) => `${n.id}(${n.owner_by})`).join(", ")}`);
    for (const w of r.warnings) log(`警告: ${w}`);
    return 0;
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    log(`incoming: 止まる — ${e.message}`);
    return e.code;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = run(process.cwd(), process.argv.slice(2));
