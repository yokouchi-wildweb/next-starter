#!/usr/bin/env node
// 指令メールボックスの補助スクリプト（/order・/inbox 共通）
// 置き場: $TEAM_ORDERS（既定 ~/.team/orders）
//   <root>/<repo-id>/*.md      = そのリポ宛ての未対応の指令
//   <root>/<repo-id>/done/*.md = 対応済み
//   council の legate は council 自身のフォルダ（~/.team/_council/legates/）にあり、ここには単発の指令（from: council <議題id>）だけが入る
// 使い方:
//   node mailbox.mjs self    自リポの repo-id と受信箱
//   node mailbox.mjs from    起票する指令の from: 行（チームのタブなら発行元はそのチーム。下記 fromLine）
//   node mailbox.mjs repos   手元のリポ（自リポと同じ親ディレクトリにあるもの）と各受信箱
//   node mailbox.mjs inbox   自リポ宛ての未対応の指令（waiting_on: の待ち状態つき）
//   node mailbox.mjs resolve <指令ファイル> --status=<done|partial|relayed|rejected|withdrawn> --body=<ファイル>
//                            [--commit=<sha|->] [--pushed=<yes|no|...>] [--branch=<名前>]
//                            指令に答える: RESOLUTION を末尾に追記し、先頭の status: をその status に書き換えて done/ へ移す
//                            （/inbox 手順 4 と guild close の共通の書き手）
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.env.TEAM_ORDERS || join(homedir(), ".team", "orders");

function git(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

// flux の fork-id 導出と同じ規則: ホスト以降のパスから .git を除き、/ を -- に、小文字化
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

function repoInfo(dir) {
  const top = git(dir, ["rev-parse", "--show-toplevel"]);
  if (!top) return null;
  const origin = git(top, ["remote", "get-url", "origin"]);
  const upstream = git(top, ["remote", "get-url", "upstream"]);
  const repoId = origin ? forkIdFromUrl(origin) : `local--${basename(top).toLowerCase()}`;
  return { top, origin, upstream, repoId };
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
    const info = repoInfo(dir);
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
  const self = repoInfo(process.cwd());
  if (!self) {
    console.error("not inside a git repository");
    process.exit(1);
  }
  const cmd = process.argv[2];

  if (cmd === "self") {
    console.log(`self: ${self.repoId}\norigin: ${self.origin || "-"}\ntop: ${self.top}\nbox: ${boxOf(self.repoId)}\nroot: ${ROOT}`);
  } else if (cmd === "from") {
    const branch = git(self.top, ["rev-parse", "--abbrev-ref", "HEAD"]);
    console.log(`from: ${fromLine(process.env, { origin: self.origin, repoId: self.repoId, branch, cwd: process.cwd() })}`);
  } else if (cmd === "repos") {
    for (const r of localRepos(self)) {
      const mark = r.repoId === self.repoId ? " (self)" : "";
      console.log(`repo: ${r.repoId}${mark}\n  url: ${r.origin || "-"}\n  path: ${r.paths.join(", ")}\n  rules: ${rulesPath(r.paths[0])}\n  box: ${boxOf(r.repoId)}`);
    }
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
    console.error("usage: node mailbox.mjs self | from | repos | inbox | resolve <指令ファイル> --status=… --body=<ファイル>");
    process.exit(1);
  }
}
