#!/usr/bin/env node
// 指令メールボックスの補助スクリプト（/order・/inbox 共通）
// 置き場: $TEAM_ORDERS（既定 ~/.team/orders）
//   <root>/<fork-id>/*.md      = そのリポ宛ての未対応の指令
//   <root>/<fork-id>/done/*.md = 対応済み
//   fork-id = 各 checkout の repo.json の repo_id（古い形は .claude/rules/project.md の `fork_id:`。小文字・数字・ハイフン。下記 forkIdOf）
//   council の legate は council 自身のフォルダ（~/.team/_council/legates/）にあり、ここには単発の指令（from: council <議題id>）だけが入る
// 使い方:
//   node mailbox.mjs self    自リポの fork-id と受信箱
//   node mailbox.mjs from    起票する指令の from: 行（チームのタブなら発行元はそのチーム。下記 fromLine）
//   node mailbox.mjs repos   手元のリポ（自リポと同じ親ディレクトリにあるもの）と各受信箱
//   node mailbox.mjs me      この者の名前（taken_by / routed_by に書く値。下記 actorOf）
//   node mailbox.mjs inbox   自リポ宛ての未対応の指令（状態 open | routed | taken、waiting_on: の待ち、担当が自分なら (you)）
//   node mailbox.mjs route <指令> --to=<council <id> | guild:<instance|name> | legate <id>.<k> plan-SS> [--by=]
//                            振り分ける: open | routed → routed（振り直し可）。着手中は断る
//   node mailbox.mjs take <指令> [--as=<id>]      着手する: open → taken。routed は振り分け先の本人だけ（違えば担当を出して断る）
//   node mailbox.mjs release <指令> [--as=<id>] [--force=<理由>]   手放す: taken → 取る前の状態（取った者だけ）
//   node mailbox.mjs unroute <指令> [--as=<id>] [--force=<理由>]   振り分けを外す: routed → open（振り分け先か振り分けた者だけ）
//   node mailbox.mjs name-check <名前>   その名前を自リポの fork_id: にしてよいか（形・fleet.conf・手元のリポ・既存の受信箱と
//                            重ならないか。/fork-init が名前を決めるときに使う。重なれば理由を出して exit 1）
//   node mailbox.mjs resolve <指令ファイル> --status=<done|partial|relayed|rejected|withdrawn> --body=<ファイル>
//                            [--commit=<sha|->] [--pushed=<yes|no|...>] [--branch=<名前>] [--as=<id>] [--force=<理由>]
//                            指令に答える: RESOLUTION を末尾に追記し、先頭の status: をその status に書き換えて done/ へ移す。
//                            他人の taken・別の振り分け先の routed は断る（--force で通すと RESOLUTION に forced: が残る）
//                            （/inbox 手順 4 と guild close の共通の書き手）。隣にブラウザ確認のシートがあれば一緒に done/ へ移す
//   node mailbox.mjs check <add | file | attach | run | result | show> …   ブラウザ確認のシート（<指令>.check.md。書式は checkSheet.mjs）
//                            add --sheet=<path> --page=/<パス> --as=guest|user|admin --step=<手順>（繰り返す）--expect=<期待>
//                                [--needs=] [--widths=375,1280] [--source=] [--title=] [--base=]   項目を足す（無ければ作る。同じ項目はまとめる）
//                            file --sheet=<path> --to=<fork-id | checkout のパス> --title=<題> [--why=] [--only=C1,C2] [--slug=] [--from=]
//                                宛先の受信箱にブラウザ確認の指令（kind: browser-check）とシートを並べて書く（道具の入口。元のシートは残す）
//                            attach <指令ファイル> --sheet=<path> [--only=C1,C2]   書いた指令にシートを付ける（only = その項目だけ、結果を消して was: に）
//                            run <sheet>   1 回の確認の始まり（runs +1）| result <sheet> C<n> ok|ng|skip [--evidence=]   結果を書き戻す
//                            show <sheet>  数と、まだ結果のない項目・スクリーンショットの置き場
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmdirSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { addItem, copySheet, isSheetFile, readSheet, setResult, sheetPathFor, shotsDirOf, startRun, summarize, writeSheet } from "./checkSheet.mjs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.env.TEAM_ORDERS || join(homedir(), ".team", "orders");

function git(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// 旧い導き方（移行中の戻り先と、旧い受信箱の名前）: ホスト以降のパスから .git を除き、/ を -- に、小文字化
export function forkIdFromUrl(url) {
  if (!url) return "";
  let path;
  const scp = url.match(/^[^/@:]+@[^:]+:(.+)$/);
  if (scp) path = scp[1];
  else {
    try {
      path = new URL(url).pathname;
    } catch {
      path = url;
    }
  }
  return path.replace(/^\/+/, "").replace(/\.git$/, "").replace(/\/+$/, "").split("/").join("--").toLowerCase();
}

export const FORK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

// 宣言された名前: repo.json の repo_id を先に、無ければ古い形の project.md の fork_id:（宣言が無ければ ""。旧い `-` もそのまま返す）。
// 手元のほかのリポ（まだ移していないリポ）も読むので、古い形も読む（~/.team/_bin の tk_fork_id_declared と同じ順）
export function declaredForkId(top) {
  const repoJson = join(top, "repo.json");
  if (existsSync(repoJson)) {
    try {
      const v = JSON.parse(readFileSync(repoJson, "utf8"))?.repo_id;
      return typeof v === "string" ? v : "";
    } catch {
      return "";
    }
  }
  const file = join(top, ".claude", "rules", "project.md");
  if (!existsSync(file)) return "";
  const m = readFileSync(file, "utf8").match(/^fork_id:[ \t]*(\S*)/m);
  return m ? m[1] : "";
}

// リポの名前（受信箱の名前）= repo.json の repo_id（古い形は project.md の fork_id:。council 20261030-104205 D27。~/.team/_bin の tk_fork_id_of と同じ規則）。
// 形が違えば throw。未宣言（行なし・旧い `-`）は移行中だけ旧い導き方に戻る（declared: false）。
// env TK_FORK_ID_STRICT=1 なら未宣言も throw（移行の終わり）
export function forkIdOf(top, origin, env = process.env) {
  const v = declaredForkId(top);
  if (v && v !== "-") {
    if (!FORK_ID_RE.test(v)) throw new Error(`repo_id の形が違います（${v}: 小文字・数字・ハイフン）: ${top}/repo.json`);
    return { id: v, declared: true };
  }
  if (env.TK_FORK_ID_STRICT === "1") throw new Error(`repo_id が宣言されていません: ${top}/repo.json`);
  return { id: origin ? forkIdFromUrl(origin) : `local--${basename(top).toLowerCase()}`, declared: false };
}

function repoInfo(dir) {
  const top = git(dir, ["rev-parse", "--show-toplevel"]);
  if (!top) return null;
  const origin = git(top, ["remote", "get-url", "origin"]);
  const upstream = git(top, ["remote", "get-url", "upstream"]);
  const { id: repoId, declared } = forkIdOf(top, origin);
  const oldId = origin ? forkIdFromUrl(origin) : `local--${basename(top).toLowerCase()}`;
  if (declared) settleBox(repoId, oldId);
  return { top, origin, upstream, repoId, declared, oldId };
}

// 宣言済みのリポの受信箱を fork-id の名前へ移す（~/.team/_bin の tk_box_settle と同じ規則。名前を読むたびに呼ぶ）:
// 旧い箱だけ → 改名 / 両方（古い送り手が旧い箱を作り直した分裂）→ 旧い方の指令（open と done/）を移す。同名は上書きせず残して言う /
// どちらもない → 新しく作る。最後に旧い名前を新しい箱へのリンクにする（旧い名前で書く送り手も同じ箱に入る）。旧い名前がリンクなら何もしない
export function settleBox(id, oldId, root = ROOT) {
  if (!oldId || oldId === id || !existsSync(root)) return;
  const n = join(root, id);
  const o = join(root, oldId);
  let st = null;
  try {
    st = lstatSync(o);
  } catch {
    st = null;
  }
  if (st && st.isSymbolicLink()) return;
  if (st && st.isDirectory() && !existsSync(n)) {
    try {
      renameSync(o, n);
    } catch {
      return; // 別の処理が先に移した
    }
  } else if (st && st.isDirectory()) {
    let left = false;
    for (const sub of ["", "done"]) {
      const from = join(o, sub);
      if (!existsSync(from)) continue;
      mkdirSync(join(n, sub), { recursive: true });
      for (const f of readdirSync(from)) {
        if (!f.endsWith(".md") && !f.endsWith(".check")) continue;   // .check = ブラウザ確認のスクリーンショットの置き場
        if (existsSync(join(n, sub, f))) left = true;
        else renameSync(join(from, f), join(n, sub, f));
      }
    }
    try {
      if (existsSync(join(o, "done"))) rmdirSync(join(o, "done"));
      rmdirSync(o);
    } catch {
      left = true;
    }
    if (left) {
      console.error(`注意: 受信箱 ${o} に移せなかったファイルが残っています（${n} と同じ名前）`);
      return;
    }
  } else {
    mkdirSync(n, { recursive: true });
  }
  try {
    symlinkSync(id, o);
  } catch {
    // 別の処理が先に張った
  }
}

// fleet.conf の `<名前> <パス>` の行（~ 可、# はコメント）
function fleetConf(env = process.env) {
  const file = env.FLEET_CONF || join(homedir(), ".team", "fleet.conf");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .filter(([n, p]) => n && p && !n.startsWith("#"))
    .map(([n, p]) => ({ name: n, path: resolve(p.replace(/^~(?=\/)/, homedir())) }));
}

// その名前を self の fork_id: にしてよいか: 重なる理由の一覧（空 = よい）。
// fleet.conf の別のパスの名前・手元の別のリポの名前・持ち主が self でない既存の受信箱と重なれば不可（D30 K3）
export function nameProblems(name, self, others, conf, root = ROOT) {
  const out = [];
  if (!FORK_ID_RE.test(name)) out.push(`形が違います（${name}: 小文字・数字・ハイフン）`);
  for (const c of conf) if (c.name === name && c.path !== resolve(self.top)) out.push(`fleet.conf で ${c.path} の名前です`);
  for (const r of others) if (r.top !== self.top && r.repoId === name) out.push(`手元の別のリポ ${r.top} の名前です`);
  const box = join(root, name);
  if (existsSync(box)) {
    const mine = self.repoId === name || self.oldId === name || linkTo(join(root, self.oldId)) === name;
    if (!mine) out.push(`受信箱 ${box} がすでにあります（持ち主が別）`);
  }
  return out;
}

function linkTo(p) {
  try {
    return readlinkSync(p);
  } catch {
    return "";
  }
}

function rulesPath(top) {
  const file = join(top, ".claude", "rules", "project.md");
  return existsSync(file) ? file : "-";
}

function boxOf(repoId) {
  return join(ROOT, repoId);
}

// 同じ origin の複数 checkout（worktree・複製）は 1 件にまとめる
function localRepos(self) {
  const byId = new Map();
  let entries = [];
  try {
    entries = readdirSync(dirname(self.top), { withFileTypes: true });
  } catch {
    entries = [];
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = join(dirname(self.top), e.name);
    if (!existsSync(join(dir, ".git"))) continue;
    let info;
    try {
      info = repoInfo(dir);
    } catch (e) {
      console.error(`注意: ${e.message}`);
      continue;
    }
    if (!info || info.top !== dir) continue;
    if (!byId.has(info.repoId)) byId.set(info.repoId, { ...info, paths: [] });
    byId.get(info.repoId).paths.push(dir);
  }
  return [...byId.values()].sort((a, b) => a.repoId.localeCompare(b.repoId));
}

// 起票する指令の from: の値。チームのタブ（起動スクリプトが TK_TEAM 等を export する）では発行元 = そのチームで、
// 動いていたリポは repo: に参考として残す。評議会の legate の `council <議題id> | instance:…` と同じく先頭が発行元
//   チーム: <team> <instance> | role:<役職名> | repo:<origin> | branch:<b> | cwd:<path>
//   それ以外: <origin> | branch:<b> | cwd:<path>
export function fromLine(env, { origin, repoId, branch, cwd }) {
  const repo = origin || repoId;
  if (env.TK_TEAM && env.TK_INSTANCE) {
    const role = env.TK_LABEL || env.TK_ROLE || "-";   // TK_LABEL が無いのは、それを渡す前に起動したタブ
    return `${env.TK_TEAM} ${env.TK_INSTANCE} | role:${role} | repo:${repo} | branch:${branch || "-"} | cwd:${cwd}`;
  }
  return `${repo} | branch:${branch || "-"} | cwd:${cwd}`;
}

// 指令の発行元（from: の値）を読む。先頭が発行元
//   council = 評議会の legate（`council <議題id> | …`、role: 欄なし）| team = チームの役職（role: 欄あり）| repo = リポのセッション
// 戻り値 { kind, label（一覧に出す名前）, repo（発行元のリポ。council は null）}
export function requester(from) {
  const [head = "", ...rest] = from.split(" | ").map((x) => x.trim());
  const kv = Object.fromEntries(rest.map((x) => [x.slice(0, x.indexOf(":")), x.slice(x.indexOf(":") + 1)]).filter(([k]) => k));
  if (kv.role) return { kind: "team", label: `${head} ${kv.role}`, repo: kv.repo || null };
  if (head.startsWith("council ")) return { kind: "council", label: head, repo: null };
  return { kind: "repo", label: head, repo: head };
}

function field(text, name) {
  const line = text.split("\n").find((l) => l.startsWith(`${name}:`));
  return line ? line.slice(name.length + 1).trim() : "";
}

function fields(text, name) {
  return text
    .split("\n")
    .filter((l) => l.startsWith(`${name}:`))
    .map((l) => l.slice(name.length + 1).trim());
}

function mdFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") && !isSheetFile(f))   // 隣のシート（.check.md）は指令ではない
      .map((f) => join(dir, f))
      .filter((p) => statSync(p).isFile())
      .sort();
  } catch {
    return [];
  }
}

// waiting_on: の先の状態。受信箱にあれば open、done/ にあれば done。
// 引き渡しで中継されていれば（relayed_to:）中継先をたどる
function orderState(path) {
  let cur = path.replace(/^~(?=\/)/, homedir());
  for (let i = 0; i < 10; i++) {
    if (existsSync(cur)) return { state: "open", path: cur };
    const done = join(dirname(cur), "done", basename(cur));
    if (!existsSync(done)) return { state: "missing", path: cur };
    const next = field(readFileSync(done, "utf8"), "relayed_to");
    if (!next) return { state: "done", path: done };
    cur = join(ROOT, next);
  }
  return { state: "missing", path: cur };
}

// RESOLUTION の本文（--body）に status ごとに要る行。評議会の legate からの指令（requester が council）の done / partial は findings / verify も
const REQUIRED = {
  done: ["implemented", "consume", "propagate", "notice", "notes"],
  partial: ["implemented", "consume", "propagate", "notice", "notes"],
  relayed: ["relayed_to", "notes"],
  rejected: ["notes"],
  withdrawn: ["notes"],
};

function isoNow(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

// ---- 指令の状態（status: は 1 つの値）--------------------------------------------------------------
// open（未対応）→ routed（評議会・ギルド・legate の計画に振り分け済み）→ taken（担当が着手）→ 答え（REQUIRED の status）
// routed は routed_to / routed_by / routed_at、taken は taken_by / taken_at を先頭に持つ（今の状態。release で taken_* は消える）。
// 移り変わりは末尾の `## STATUS_LOG` に 1 行ずつ足す（消さない。前の担当が見える）。答え（resolve）の記録は RESOLUTION が持つ。
// status: が無い・知らない値の古い指令は open として読む
export const LIVE = ["open", "routed", "taken"];
const HEAD_KEYS = ["status", "routed_to", "routed_by", "routed_at", "taken_by", "taken_at"];

// 先頭（最初の `## ` より前）と残り
function splitHead(text) {
  const i = text.search(/^## /m);
  const end = i < 0 ? text.length : i;
  return [text.slice(0, end), text.slice(end)];
}

function headField(text, name) {
  return field(splitHead(text)[0], name);
}

// 先頭の欄を書き換える（null = 消す）。無い欄は HEAD_KEYS の並びで前の欄の次（status は date: の次。古い形の指令）に足す
function setHead(text, sets) {
  let [top, rest] = splitHead(text);
  for (const [k, v] of Object.entries(sets)) {
    const line = new RegExp(`^${k}:.*$`, "m");
    if (line.test(top)) {
      top = v == null ? top.replace(new RegExp(`^${k}:.*\\n?`, "m"), "") : top.replace(line, () => `${k}: ${v}`);
      continue;
    }
    if (v == null) continue;
    const anchors = [...HEAD_KEYS.slice(0, HEAD_KEYS.indexOf(k)).reverse(), "date", "to", "from"];
    const a = anchors.find((x) => new RegExp(`^${x}:`, "m").test(top));
    top = a
      ? top.replace(new RegExp(`^${a}:.*$`, "m"), (l) => `${l}\n${k}: ${v}`)
      : top.replace(/^.*$/m, (l) => `${l}\n${k}: ${v}`);
  }
  return top + rest;
}

// `## STATUS_LOG` に 1 行足す（無ければ末尾に作る）
function appendLog(text, entry) {
  const lines = text.split("\n");
  const h = lines.indexOf("## STATUS_LOG");
  if (h < 0) return `${text.endsWith("\n") ? text : `${text}\n`}\n## STATUS_LOG\n${entry}\n`;
  let i = h + 1;
  while (i < lines.length && lines[i].startsWith("- ")) i++;
  lines.splice(i, 0, entry);
  return lines.join("\n");
}

// クエストの印 = 先頭の `kind: quest`（/order の引数 quest・評議会の起票の道具が書く）。印の正はこの欄だけで、題の書き方では読まない
export function isQuest(text) {
  return headField(text, "kind") === "quest";
}

export function orderStatus(text) {
  const s = headField(text, "status");
  return LIVE.includes(s) || REQUIRED[s] ? s : "open";
}

// 動いている者の名前（taken_by / routed_by に書く）
//   チームのタブ: <team> <instance> | role:<役職名>（from: と同じ環境変数）| リポのセッション: <origin> | branch:<b>
export function actorOf(env, { origin, repoId, branch }) {
  if (env.TK_TEAM && env.TK_INSTANCE) return `${env.TK_TEAM} ${env.TK_INSTANCE} | role:${env.TK_LABEL || env.TK_ROLE || "-"}`;
  return `${origin || repoId} | branch:${branch || "-"}`;
}

// 同じ担当かを比べる鍵: チーム（role: 欄あり）は <team> <instance>（同じタブの組の誰でも）、リポは cwd: を除いた全体
function actorKey(a) {
  const parts = String(a).split(" | ").map((x) => x.trim()).filter((x) => x && !x.startsWith("cwd:"));
  return parts.some((x) => x.startsWith("role:")) ? parts[0] : parts.join(" | ");
}

export function sameActor(a, b) {
  return actorKey(a) === actorKey(b);
}

// routed_to（council <id> | guild:<instance|name> | legate <id>.<k> plan-SS）がこの者を指すか。
// as = 明示した名前（--as）。チームのタブは council <instance> / <team>:<instance> / <team> <instance> とも照合する
export function routedMatches(routedTo, actor, as, env = {}) {
  const norm = (s) => String(s).trim().replace(/\s+/g, " ");
  const want = norm(routedTo);
  const names = as ? [as] : [actor, actorKey(actor)];
  if (!as && env.TK_TEAM && env.TK_INSTANCE) names.push(`${env.TK_TEAM} ${env.TK_INSTANCE}`, `${env.TK_TEAM}:${env.TK_INSTANCE}`);
  return names.some((n) => norm(n) === want);
}

function whoHas(text) {
  const s = orderStatus(text);
  if (s === "taken") return `taken by ${headField(text, "taken_by") || "?"}`;
  if (s === "routed") return `routed to ${headField(text, "routed_to") || "?"}`;
  return s;
}

function writeAtomic(path, text) {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function liveOrder(orderPath) {
  if (!existsSync(orderPath)) throw new Error(`指令がありません: ${orderPath}（対応済みなら done/ にあります）`);
  if (basename(dirname(orderPath)) === "done") throw new Error(`done/ の指令の状態は変えません: ${orderPath}`);
  const text = readFileSync(orderPath, "utf8");
  if (/^## RESOLUTION$/m.test(text)) throw new Error(`すでに RESOLUTION があります: ${orderPath}`);
  return text;
}

// 振り分ける: open | routed → routed（振り直しも可。ログに残る）。taken は断る（取った者が release してから）
export function routeOrder(orderPath, { to, by, now = isoNow() }) {
  if (!to) throw new Error("--to=<council <id> | guild:<instance|name> | legate <id>.<k> plan-SS> が要ります");
  const text = liveOrder(orderPath);
  const s = orderStatus(text);
  if (s === "taken") throw new Error(`着手中です（${whoHas(text)}）: 振り分けるなら取った者が release してから`);
  const next = setHead(text, { status: "routed", routed_to: to, routed_by: by, routed_at: now });
  writeAtomic(orderPath, appendLog(next, `- ${now} ${s} → routed | to:${to} | by:${by}`));
  return { from: s, to: "routed" };
}

// 着手する: open → taken（誰でも）| routed → taken（routed_to が自分のときだけ）| 他人の taken は断る
export function takeOrder(orderPath, { actor, as, env = {}, now = isoNow() }) {
  const text = liveOrder(orderPath);
  const s = orderStatus(text);
  const who = as || actor;
  if (s === "taken") {
    const holder = headField(text, "taken_by");
    if (sameActor(holder, who)) throw new Error(`すでに自分が着手しています（taken by ${holder}）`);
    throw new Error(`他の担当が着手しています: taken by ${holder}（担当に確かめる。止まっているなら担当か人が release）`);
  }
  if (s === "routed") {
    const to = headField(text, "routed_to");
    if (!routedMatches(to, actor, as, env)) throw new Error(`振り分け先が別です: routed to ${to}（その担当が take する。自分でやるなら人の判断で振り直す）`);
  }
  const next = setHead(text, { status: "taken", taken_by: who, taken_at: now });
  writeAtomic(orderPath, appendLog(next, `- ${now} ${s} → taken | by:${who}`));
  return { from: s, to: "taken" };
}

// 手放す: taken → 取る前の状態（routed_to があれば routed、無ければ open）。取った者だけ（force = 理由。止まったセッションの片付け）
export function releaseOrder(orderPath, { actor, as, force, now = isoNow() }) {
  const text = liveOrder(orderPath);
  const s = orderStatus(text);
  if (s !== "taken") throw new Error(`着手中ではありません（${whoHas(text)}）`);
  const holder = headField(text, "taken_by");
  const who = as || actor;
  if (!sameActor(holder, who) && !force) throw new Error(`取ったのは別の担当です: taken by ${holder}（片付けるなら --force=<理由>）`);
  const back = headField(text, "routed_to") ? "routed" : "open";
  const next = setHead(text, { status: back, taken_by: null, taken_at: null });
  const why = force && !sameActor(holder, who) ? ` | forced:${force} (was taken by ${holder})` : "";
  writeAtomic(orderPath, appendLog(next, `- ${now} taken → ${back} | by:${who}${why}`));
  return { from: s, to: back };
}

// 振り分けを外す: routed → open（routed_* は消える。ログに残る）。振り分け先の本人か振り分けた者だけ（force = 理由）。
// 着手中は断る（取った者が release してから）
export function unrouteOrder(orderPath, { actor, as, env = {}, force, now = isoNow() }) {
  const text = liveOrder(orderPath);
  const s = orderStatus(text);
  if (s !== "routed") throw new Error(`振り分けられていません（${s === "taken" ? whoHas(text) : s}）${s === "taken" ? ": 外すなら取った者が release してから" : ""}`);
  const to = headField(text, "routed_to");
  const who = as || actor;
  const mine = routedMatches(to, actor, as, env) || sameActor(headField(text, "routed_by"), who);
  if (!mine && !force) throw new Error(`振り分け先は別の担当です: routed to ${to}（外すなら --force=<理由>）`);
  const next = setHead(text, { status: "open", routed_to: null, routed_by: null, routed_at: null });
  const why = mine ? "" : ` | forced:${force} (was routed to ${to})`;
  writeAtomic(orderPath, appendLog(next, `- ${now} routed → open | to:${to} | by:${who}${why}`));
  return { from: s, to: "open" };
}

// 答えてよいか: 他人の taken・別の振り分け先の routed は断る（force = 理由。RESOLUTION の forced: に残る）
function resolveGuard(text, { actor, as, env, force }) {
  if (!actor) return "";
  const s = orderStatus(text);
  const who = as || actor;
  let blocked = "";
  if (s === "taken" && !sameActor(headField(text, "taken_by"), who)) blocked = whoHas(text);
  if (s === "routed" && !routedMatches(headField(text, "routed_to"), actor, as, env)) blocked = whoHas(text);
  if (!blocked) return "";
  if (!force) throw new Error(`この指令は ${blocked} です: 担当以外は答えません（人の判断で答えるなら --force=<理由>）`);
  return `forced: ${force} (was ${blocked}; resolved by ${who})`;
}

// 指令に答える: 確かめてから RESOLUTION を追記し、先頭の status: を RESOLUTION の status に書き換えて done/ へ移す
// （ファイルだけを読んでも状態が分かるように）。足りないものがあれば何も書かずに throw する。
// by = { repoId, origin, branch, commit, pushed }。actor / as / env / force = 担当の守り（resolveGuard。actor が無ければ確かめない）。
// 戻り値 = 移した先のパス
export function resolveOrder(orderPath, { status, body, by, now = isoNow(), actor, as, env = {}, force }) {
  if (!REQUIRED[status]) throw new Error(`--status は ${Object.keys(REQUIRED).join(" | ")} のどれか（${status || "なし"}）`);
  if (!existsSync(orderPath)) throw new Error(`指令がありません: ${orderPath}（対応済みなら done/ にあります）`);
  if (basename(dirname(orderPath)) === "done") throw new Error(`done/ の指令には答えません: ${orderPath}`);
  const text = readFileSync(orderPath, "utf8");
  if (/^## RESOLUTION$/m.test(text)) throw new Error(`すでに RESOLUTION があります: ${orderPath}`);
  const forced = resolveGuard(text, { actor, as, env, force });
  const lines = body.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() !== "");
  const want = [...REQUIRED[status]];
  if ((status === "done" || status === "partial") && requester(field(text, "from")).kind === "council") want.push("findings", "verify");
  const missing = want.filter((k) => !lines.some((l) => l.startsWith(`${k}:`)));
  if (missing.length) throw new Error(`RESOLUTION の本文に ${missing.map((k) => `${k}:`).join(" ")} の行がありません`);
  const full = status === "done" || status === "partial";
  if (full && !by.pushed) throw new Error("--pushed が要ります（yes | no と理由。commit しなかったなら -）");
  const byLine = full
    ? `by: ${by.repoId} | ${by.origin || "-"} | branch:${by.branch || "-"} | commit:${by.commit || "-"} | pushed:${by.pushed}`
    : `by: ${by.repoId} | commit:- | pushed:-`;
  const block = ["", "## RESOLUTION", `resolved: ${now}   status: ${status}`, byLine, ...lines, ...(forced ? [forced] : []), ""].join("\n");
  writeAtomic(orderPath, setHead(text, { status }) + (text.endsWith("\n") ? "" : "\n") + block);
  const doneDir = join(dirname(orderPath), "done");
  mkdirSync(doneDir, { recursive: true });
  const dest = join(doneDir, basename(orderPath));
  renameSync(orderPath, dest);
  moveSheet(orderPath, text, doneDir);
  return dest;
}

// 指令の隣のシート（先頭の check_sheet:、無ければ <名前>.check.md）とスクリーンショットの置き場を dir へ移す
function sheetOf(orderPath, text) {
  const name = headField(text, "check_sheet");
  return name ? join(dirname(orderPath), name) : sheetPathFor(orderPath);
}

function moveSheet(orderPath, text, dir) {
  const sheet = sheetOf(orderPath, text);
  for (const p of [sheet, shotsDirOf(sheet)]) if (existsSync(p)) renameSync(p, join(dir, basename(p)));
}

// 指令ファイルの先頭に欄を足す・書き換える（無ければ kind: か status: の次）
function setHeadAfter(text, key, value) {
  let [top, rest] = splitHead(text);
  const line = new RegExp(`^${key}:.*$`, "m");
  if (line.test(top)) top = top.replace(line, () => `${key}: ${value}`);
  else {
    const a = ["kind", "status", "date"].find((x) => new RegExp(`^${x}:`, "m").test(top));
    top = a ? top.replace(new RegExp(`^${a}:.*$`, "m"), (l) => `${l}\n${key}: ${value}`) : top.replace(/^.*$/m, (l) => `${l}\n${key}: ${value}`);
  }
  return top + rest;
}

// 書いた指令にシートを付ける: src のシートを <指令>.check.md へ写し（only = その項目だけ。結果を消して was: に）、
// シートの先頭の order: / repo: を指令に合わせ、指令の先頭に check_sheet: を書く。戻り値 = シートのパス
export function attachSheet(orderPath, { src, only, now = isoNow(), title }) {
  const text = liveOrder(orderPath);
  const id = (text.match(/^# ORDER id:(\S+)/m) || [])[1];
  if (!id) throw new Error(`指令の 1 行目が # ORDER id:<id> ではありません: ${orderPath}`);
  const dest = sheetPathFor(orderPath);
  const sheet = copySheet(readSheet(src), { only, now, order: id, repo: basename(dirname(orderPath)), title: title || headField(text, "title") || undefined });
  if (!sheet.items.length) throw new Error(`シートに項目がありません: ${src}`);
  if (resolve(src) === resolve(dest)) sheet.head = { ...readSheet(src).head, order: id, repo: basename(dirname(orderPath)), updated: now };
  writeSheet(dest, sheet);
  writeAtomic(orderPath, setHeadAfter(text, "check_sheet", basename(dest)));
  return dest;
}

export function tsId(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// 道具の入口: 宛先の受信箱 box にブラウザ確認の指令（kind: browser-check）を書き、src のシートを隣に付ける（src は残す）。
// to = 宛先の `<origin> | box:<fork-id>`、from = 発行元の行。戻り値 { order, sheet }
export function fileCheckOrder({ box, to, from, src, title, why, only, slug = "browser-check", now = new Date() }) {
  if (!title) throw new Error("--title=<日本語の短い題> が要ります");
  const sheet = readSheet(src);
  const n = only && only.length ? only.length : sheet.items.length;
  if (!n) throw new Error(`シートに項目がありません: ${src}`);
  mkdirSync(box, { recursive: true });
  let id = `${tsId(now)}-${slug}`;
  for (let i = 2; existsSync(join(box, `${id}.md`)); i++) id = `${tsId(now)}-${slug}-${i}`;
  const sources = [...new Set(sheet.items.flatMap((it) => it.source).filter((s) => s && s !== "-").map((s) => s.split(" ")[0]))];
  const orderPath = join(box, `${id}.md`);
  const iso = isoNow(now);
  writeFileSync(orderPath, [
    `# ORDER id:${id}`,
    `from: ${from}`,
    `to: ${to}`,
    `date: ${iso}`,
    "status: open",
    "kind: browser-check",
    `title: ${title}`,
    `need: run the browser checks of ${id}.check.md (${n} items) with /patrol`,
    `why: ${why || `items collected by ${sources.join(", ") || "the sender"}; they need the running app, which the sender did not start`}`,
    "done_when: every item of the sheet has a result (ok | ng | skip); ng items handed on as fix orders, each with a sheet of its ng items",
    "constraints: -",
    `refs: ${src}`,
    "notes: -",
    "",
  ].join("\n"));
  const dest = attachSheet(orderPath, { src, only, now: iso, title });
  return { order: orderPath, sheet: dest };
}

// 一覧の 1 件。先頭の語 = open | routed | taken | waiting | resumable（waiting_on: があれば待ちが先）。
// routed_to / taken_by が自分を指せば (you) を付ける（/ship の担当の確かめもこれを読む）
function printOrder(path, actor, env) {
  const text = readFileSync(path, "utf8");
  const waits = fields(text, "waiting_on").map(orderState);
  let state = orderStatus(text);
  if (waits.length) state = waits.every((w) => w.state === "done") ? "resumable" : "waiting";
  const title = headField(text, "title");
  const kind = headField(text, "kind");
  console.log(`${state} ${path}\n  from: ${requester(field(text, "from")).label}${kind ? `\n  kind: ${kind}` : ""}${title ? `\n  title: ${title}` : ""}\n  need: ${field(text, "need")}`);
  const sheet = sheetOf(path, text);
  if (existsSync(sheet)) {
    try {
      const n = summarize(readSheet(sheet));
      console.log(`  check_sheet: ${basename(sheet)} | ${n.total} items | ok ${n.ok} ng ${n.ng} skip ${n.skip} pending ${n.pending}`);
    } catch (e) {
      console.log(`  check_sheet: ${basename(sheet)} | 読めません: ${e.message}`);
    }
  }
  const to = headField(text, "routed_to");
  const by = headField(text, "taken_by");
  if (to) console.log(`  routed_to: ${to}${routedMatches(to, actor, undefined, env) ? " (you)" : ""}`);
  if (orderStatus(text) === "taken") console.log(`  taken_by: ${by}${sameActor(by, actor) ? " (you)" : ""}`);
  for (const w of waits) console.log(`  waiting_on: ${w.state} ${w.path}`);
}

// 直接実行されたときだけ CLI として動く（テストは resolveOrder などを import する）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

// 答えた後の口: env ORDER_RESOLVED_HOOK = 実行ファイルのパス（シェルを通さない）。答えた指令（done/ の中）のパスを引数に呼ぶ。
// 設定が無ければ何もしない（fork の既定）。チームのタブはここで依頼元の統括への知らせを付ける（~/.team/_bin）。
// 口が落ちても答えは取り消さない（RESOLUTION と done/ は書き終わっている）: 理由を 1 行出して exit 0 のまま
export function afterResolve(dest, env = process.env) {
  const hook = env.ORDER_RESOLVED_HOOK;
  if (!hook) return;
  try {
    execFileSync(hook, [dest], { stdio: "inherit", env });
  } catch (e) {
    console.error(`resolve: 答えた後の口（ORDER_RESOLVED_HOOK=${hook}）が落ちました: ${e.message.split("\n")[0]}`);
  }
}

function opt(args, name) {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a === undefined ? undefined : a.slice(name.length + 3);
}

function opts(args, name) {
  return args.filter((x) => x.startsWith(`--${name}=`)).map((x) => x.slice(name.length + 3));
}

function home(p) {
  return p ? p.replace(/^~(?=\/)/, homedir()) : p;
}

function onlyOf(args) {
  const v = opt(args, "only");
  return v ? v.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
}

// 宛先（fork-id か checkout のパス）→ { box, to }。パスならそのリポを読み、名前なら手元のリポ（repos と同じ）から探す
function targetOf(self, name) {
  const dir = home(name);
  let r = null;
  if (dir && existsSync(dir) && statSync(dir).isDirectory()) r = repoInfo(dir);
  else {
    const hits = localRepos(self).filter((x) => x.repoId === name || x.paths.some((p) => basename(p) === name));
    if (hits.length > 1) throw new Error(`宛先が 1 つに決まりません: ${name}（${hits.map((x) => x.repoId).join(", ")}）`);
    r = hits[0] || null;
  }
  if (!r) throw new Error(`宛先のリポが見つかりません: ${name}（fork-id か checkout のパス）`);
  return { box: boxOf(r.repoId), to: `${r.origin || "-"} | box:${r.repoId}` };
}

function checkCli(self, args) {
  const sub = args[0];
  const rest = args.slice(1);
  const pos = rest.filter((a) => !a.startsWith("--"));
  const now = isoNow();
  if (sub === "add") {
    const sheet = home(opt(rest, "sheet"));
    if (!sheet) throw new Error("usage: check add --sheet=<path> --page=/<パス> --as=guest|user|admin --step=<手順>… --expect=<期待> [--needs=] [--widths=] [--source=] [--title=] [--base=]");
    const r = addItem(
      sheet,
      { page: opt(rest, "page"), as: opt(rest, "as"), steps: opts(rest, "step"), expect: opt(rest, "expect"), needs: opt(rest, "needs"), widths: opt(rest, "widths"), source: opt(rest, "source") },
      { now, title: opt(rest, "title"), base: opt(rest, "base") },
    );
    console.log(`check add: ${r.id}${r.merged ? " (merged: same page / as / expect)" : ""} ${sheet}`);
  } else if (sub === "file") {
    const src = home(opt(rest, "sheet"));
    const to = opt(rest, "to");
    if (!src || !to) throw new Error("usage: check file --sheet=<path> --to=<fork-id | checkout のパス> --title=<題> [--why=] [--only=C1,C2] [--slug=] [--from=]");
    const t = targetOf(self, to);
    const from = opt(rest, "from") || fromLine(process.env, { origin: self.origin, repoId: self.repoId, branch: git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]), cwd: process.cwd() });
    const r = fileCheckOrder({ box: t.box, to: t.to, from, src, title: opt(rest, "title"), why: opt(rest, "why"), only: onlyOf(rest), slug: opt(rest, "slug") || "browser-check" });
    console.log(`check file: ${r.order}\n  sheet: ${r.sheet}`);
  } else if (sub === "attach") {
    const order = home(pos[0]);
    const src = home(opt(rest, "sheet"));
    if (!order || !src) throw new Error("usage: check attach <指令ファイル> --sheet=<path> [--only=C1,C2] [--title=]");
    console.log(`check attach: ${attachSheet(order, { src, only: onlyOf(rest), now, title: opt(rest, "title") })}`);
  } else if (sub === "run") {
    if (!pos[0]) throw new Error("usage: check run <sheet>");
    console.log(`check run: run ${startRun(home(pos[0]), { now })} ${home(pos[0])}`);
  } else if (sub === "result") {
    if (!pos[0] || !pos[1] || !pos[2]) throw new Error("usage: check result <sheet> C<n> ok|ng|skip [--evidence=]");
    setResult(home(pos[0]), pos[1], { result: pos[2], evidence: opt(rest, "evidence"), now });
    console.log(`check result: ${pos[1]} ${pos[2]}`);
  } else if (sub === "show") {
    if (!pos[0]) throw new Error("usage: check show <sheet>");
    const path = home(pos[0]);
    const sheet = readSheet(path);
    const n = summarize(sheet);
    console.log(`sheet: ${path}\norder: ${sheet.head.order}  repo: ${sheet.head.repo}\ntitle: ${sheet.head.title}\nruns: ${sheet.head.runs}  last_run: ${sheet.head.lastRun}\nitems: ${n.total} | ok ${n.ok} ng ${n.ng} skip ${n.skip} pending ${n.pending}\nshots: ${shotsDirOf(path)}`);
    for (const it of sheet.items) console.log(`${it.id} ${it.result} ${it.as} ${it.page} — ${it.expect}`);
  } else {
    throw new Error("usage: check <add | file | attach | run | result | show> …（mailbox.mjs の先頭のコメント）");
  }
}

function main() {
  let self;
  try {
    self = repoInfo(process.cwd());
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (!self) {
    console.error("not inside a git repository");
    process.exit(1);
  }
  const cmd = process.argv[2];
  if (!self.declared && cmd !== "name-check") console.error(`注意: このリポは repo_id が未宣言です（移行中は旧い名前 ${self.repoId} を使う）`);

  if (cmd === "self") {
    console.log(`self: ${self.repoId}\ndeclared: ${self.declared ? "yes" : "no (old name)"}\norigin: ${self.origin || "-"}\ntop: ${self.top}\nbox: ${boxOf(self.repoId)}\nroot: ${ROOT}`);
  } else if (cmd === "from") {
    const branch = git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]);
    console.log(`from: ${fromLine(process.env, { origin: self.origin, repoId: self.repoId, branch, cwd: process.cwd() })}`);
  } else if (cmd === "repos") {
    for (const r of localRepos(self)) {
      const mark = r.repoId === self.repoId ? " (self)" : "";
      console.log(`repo: ${r.repoId}${mark}\n  url: ${r.origin || "-"}\n  path: ${r.paths.join(", ")}\n  rules: ${rulesPath(r.paths[0])}\n  box: ${boxOf(r.repoId)}`);
    }
  } else if (cmd === "name-check") {
    const name = process.argv[3];
    if (!name) {
      console.error("usage: node mailbox.mjs name-check <名前>");
      process.exit(1);
    }
    const probs = nameProblems(name, self, localRepos(self), fleetConf());
    if (probs.length) {
      for (const p of probs) console.log(`name-check: ${name} — ${p}`);
      process.exit(1);
    }
    console.log(`name-check: ${name} — ok`);
  } else if (cmd === "me") {
    console.log(`me: ${actorOf(process.env, { ...self, branch: git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]) })}`);
  } else if (cmd === "inbox") {
    const actor = actorOf(process.env, { ...self, branch: git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]) });
    const questOnly = process.argv.slice(3).includes("--quest");
    console.log(`box: ${boxOf(self.repoId)}`);
    for (const p of mdFiles(boxOf(self.repoId))) {
      if (questOnly && !isQuest(readFileSync(p, "utf8"))) continue;
      printOrder(p, actor, process.env);
    }
  } else if (["route", "take", "release", "unroute"].includes(cmd)) {
    const args = process.argv.slice(3);
    const file = args.find((a) => !a.startsWith("--"));
    const actor = actorOf(process.env, { ...self, branch: git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]) });
    try {
      if (!file) throw new Error(`usage: node mailbox.mjs ${cmd} <指令ファイル> ${{ route: "--to=<id> [--by=]", take: "[--as=<id>]", release: "[--as=<id>] [--force=<理由>]", unroute: "[--as=<id>] [--force=<理由>]" }[cmd]}`);
      const path = file.replace(/^~(?=\/)/, homedir());
      const r = cmd === "route"
        ? routeOrder(path, { to: opt(args, "to"), by: opt(args, "by") || actor })
        : cmd === "take"
          ? takeOrder(path, { actor, as: opt(args, "as"), env: process.env })
          : cmd === "release"
            ? releaseOrder(path, { actor, as: opt(args, "as"), force: opt(args, "force") })
            : unrouteOrder(path, { actor, as: opt(args, "as"), env: process.env, force: opt(args, "force") });
      console.log(`${cmd}: ${r.from} → ${r.to} ${path}`);
    } catch (e) {
      console.error(`${cmd}: ${e.message}`);
      process.exit(1);
    }
  } else if (cmd === "resolve") {
    const args = process.argv.slice(3);
    const file = args.find((a) => !a.startsWith("--"));
    const bodyFile = opt(args, "body");
    try {
      if (!file || !bodyFile) throw new Error("usage: node mailbox.mjs resolve <指令ファイル> --status=… --body=<ファイル> [--commit=] [--pushed=] [--branch=] [--as=<id>] [--force=<理由>]");
      const commit = opt(args, "commit") ?? (git(self.top, ["rev-parse", "--short", "HEAD"]) || "-");
      const branch = opt(args, "branch") ?? (git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]) || "-");
      const actor = actorOf(process.env, { ...self, branch: git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]) });
      const dest = resolveOrder(file.replace(/^~(?=\/)/, homedir()), {
        status: opt(args, "status"),
        body: readFileSync(bodyFile, "utf8"),
        by: { repoId: self.repoId, origin: self.origin, branch, commit, pushed: opt(args, "pushed") },
        actor,
        as: opt(args, "as"),
        env: process.env,
        force: opt(args, "force"),
      });
      console.log(`resolved: ${dest}`);
      afterResolve(dest, process.env);
    } catch (e) {
      console.error(`resolve: ${e.message}`);
      process.exit(1);
    }
  } else if (cmd === "check") {
    try {
      checkCli(self, process.argv.slice(3));
    } catch (e) {
      console.error(`check: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.error("usage: node mailbox.mjs self | from | me | repos | inbox | name-check <名前> | route <指令> --to=<id> | take <指令> [--as=] | release <指令> | unroute <指令> | resolve <指令ファイル> --status=… --body=<ファイル> | check <add | file | attach | run | result | show> …");
    process.exit(1);
  }
}
