#!/usr/bin/env node
// 指令メールボックスの補助スクリプト（/order・/inbox 共通）
// 置き場: $TEAM_ORDERS（既定 ~/.team/orders）
//   <root>/<fork-id>/*.md      = そのリポ宛ての未対応の指令
//   <root>/<fork-id>/done/*.md = 対応済み
//   fork-id = 各 checkout の .claude/rules/project.md の `fork_id: <短い名前>`（小文字・数字・ハイフン。下記 forkIdOf）
//   council の legate は council 自身のフォルダ（~/.team/_council/legates/）にあり、ここには単発の指令（from: council <議題id>）だけが入る
// 使い方:
//   node mailbox.mjs self    自リポの fork-id と受信箱
//   node mailbox.mjs from    起票する指令の from: 行（チームのタブなら発行元はそのチーム。下記 fromLine）
//   node mailbox.mjs repos   手元のリポ（自リポと同じ親ディレクトリにあるもの）と各受信箱
//   node mailbox.mjs inbox   自リポ宛ての未対応の指令（waiting_on: の待ち状態つき）
//   node mailbox.mjs name-check <名前>   その名前を自リポの fork_id: にしてよいか（形・fleet.conf・手元のリポ・既存の受信箱と
//                            重ならないか。/fork-init が名前を決めるときに使う。重なれば理由を出して exit 1）
//   node mailbox.mjs resolve <指令ファイル> --status=<done|partial|relayed|rejected|withdrawn> --body=<ファイル>
//                            [--commit=<sha|->] [--pushed=<yes|no|...>] [--branch=<名前>]
//                            指令に答える: RESOLUTION を末尾に追記し、先頭の status: をその status に書き換えて done/ へ移す
//                            （/inbox 手順 4 と guild close の共通の書き手）
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmdirSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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

// 宣言された fork_id: の値（行が無ければ ""。旧い `-` もそのまま返す）
export function declaredForkId(top) {
  const file = join(top, ".claude", "rules", "project.md");
  if (!existsSync(file)) return "";
  const m = readFileSync(file, "utf8").match(/^fork_id:[ \t]*(\S*)/m);
  return m ? m[1] : "";
}

// リポの名前（受信箱の名前）= project.md の fork_id:（council 20261030-104205 D27。~/.team/_bin の tk_fork_id_of と同じ規則）。
// 形が違えば throw。未宣言（行なし・旧い `-`）は移行中だけ旧い導き方に戻る（declared: false）。
// env TK_FORK_ID_STRICT=1 なら未宣言も throw（移行の終わり）
export function forkIdOf(top, origin, env = process.env) {
  const v = declaredForkId(top);
  if (v && v !== "-") {
    if (!FORK_ID_RE.test(v)) throw new Error(`fork_id: の形が違います（${v}: 小文字・数字・ハイフン）: ${top}/.claude/rules/project.md`);
    return { id: v, declared: true };
  }
  if (env.TK_FORK_ID_STRICT === "1") throw new Error(`fork_id: が宣言されていません: ${top}/.claude/rules/project.md`);
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
        if (!f.endsWith(".md")) continue;
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
      .filter((f) => f.endsWith(".md"))
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

// 先頭の `status:`（最初の `## ` より前の最初の行）を書き換える。無ければ `date:` の次に足す（古い形の指令）
function withHeaderStatus(text, status) {
  const head = text.search(/^## /m);
  const end = head < 0 ? text.length : head;
  const top = text.slice(0, end);
  const next = /^status:.*$/m.test(top)
    ? top.replace(/^status:.*$/m, `status: ${status}`)
    : top.replace(/^date:.*$/m, (l) => `${l}\nstatus: ${status}`);
  return next + text.slice(end);
}

// 指令に答える: 確かめてから RESOLUTION を追記し、先頭の status: を RESOLUTION の status に書き換えて done/ へ移す
// （ファイルだけを読んでも状態が分かるように）。足りないものがあれば何も書かずに throw する。
// by = { repoId, origin, branch, commit, pushed }。戻り値 = 移した先のパス
export function resolveOrder(orderPath, { status, body, by, now = isoNow() }) {
  if (!REQUIRED[status]) throw new Error(`--status は ${Object.keys(REQUIRED).join(" | ")} のどれか（${status || "なし"}）`);
  if (!existsSync(orderPath)) throw new Error(`指令がありません: ${orderPath}（対応済みなら done/ にあります）`);
  if (basename(dirname(orderPath)) === "done") throw new Error(`done/ の指令には答えません: ${orderPath}`);
  const text = readFileSync(orderPath, "utf8");
  if (/^## RESOLUTION$/m.test(text)) throw new Error(`すでに RESOLUTION があります: ${orderPath}`);
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
  const block = ["", "## RESOLUTION", `resolved: ${now}   status: ${status}`, byLine, ...lines, ""].join("\n");
  const tmp = `${orderPath}.tmp.${process.pid}`;
  writeFileSync(tmp, withHeaderStatus(text, status) + (text.endsWith("\n") ? "" : "\n") + block);
  renameSync(tmp, orderPath);
  const doneDir = join(dirname(orderPath), "done");
  mkdirSync(doneDir, { recursive: true });
  const dest = join(doneDir, basename(orderPath));
  renameSync(orderPath, dest);
  return dest;
}

function printOrder(path) {
  const text = readFileSync(path, "utf8");
  const waits = fields(text, "waiting_on").map(orderState);
  let state = "open";
  if (waits.length) state = waits.every((w) => w.state === "done") ? "resumable" : "waiting";
  console.log(`${state} ${path}\n  from: ${requester(field(text, "from")).label}\n  need: ${field(text, "need")}`);
  for (const w of waits) console.log(`  waiting_on: ${w.state} ${w.path}`);
}

// 直接実行されたときだけ CLI として動く（テストは resolveOrder などを import する）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

function opt(args, name) {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a === undefined ? undefined : a.slice(name.length + 3);
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
  if (!self.declared && cmd !== "name-check") console.error(`注意: このリポは fork_id: が未宣言です（移行中は旧い名前 ${self.repoId} を使う）`);

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
  } else if (cmd === "inbox") {
    console.log(`box: ${boxOf(self.repoId)}`);
    for (const p of mdFiles(boxOf(self.repoId))) printOrder(p);
  } else if (cmd === "resolve") {
    const args = process.argv.slice(3);
    const file = args.find((a) => !a.startsWith("--"));
    const bodyFile = opt(args, "body");
    try {
      if (!file || !bodyFile) throw new Error("usage: node mailbox.mjs resolve <指令ファイル> --status=… --body=<ファイル> [--commit=] [--pushed=] [--branch=]");
      const commit = opt(args, "commit") ?? (git(self.top, ["rev-parse", "--short", "HEAD"]) || "-");
      const branch = opt(args, "branch") ?? (git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]) || "-");
      const dest = resolveOrder(file.replace(/^~(?=\/)/, homedir()), {
        status: opt(args, "status"),
        body: readFileSync(bodyFile, "utf8"),
        by: { repoId: self.repoId, origin: self.origin, branch, commit, pushed: opt(args, "pushed") },
      });
      console.log(`resolved: ${dest}`);
    } catch (e) {
      console.error(`resolve: ${e.message}`);
      process.exit(1);
    }
  } else {
    console.error("usage: node mailbox.mjs self | from | repos | inbox | name-check <名前> | resolve <指令ファイル> --status=… --body=<ファイル>");
    process.exit(1);
  }
}
