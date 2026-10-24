#!/usr/bin/env node
// 指令メールボックスの補助スクリプト（/order・/upreq・/inbox 共通）
// 置き場: $TEAM_UPSTREAM_REQUESTS（既定 ~/.team/upstream-requests）
//   <root>/<repo-id>/*.md      = そのリポ宛ての未対応の指令
//   <root>/<repo-id>/done/*.md = 対応済み
//   <root>/*.md, <root>/done/*.md = 旧形式（宛先欄なし = 最上流宛て）。移し替えまでの互換
//   <root>/edict-*/, <root>/legate-*/ = council の束（00-index.md の project: で宛先を判定）
// 使い方:
//   node mailbox.mjs self    自リポの repo-id と受信箱
//   node mailbox.mjs repos   手元のリポ（自リポと同じ親ディレクトリにあるもの）と各受信箱
//   node mailbox.mjs inbox   自リポ宛ての未対応の指令（waiting_on: の待ち状態つき）と council の束
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = process.env.TEAM_UPSTREAM_REQUESTS || join(homedir(), ".team", "upstream-requests");

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

function councilDirs(self) {
  try {
    return readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^(edict|legate)-/.test(e.name))
      .map((e) => join(ROOT, e.name))
      .filter((d) => {
        const index = join(d, "00-index.md");
        if (!existsSync(index)) return false;
        const m = readFileSync(index, "utf8").match(/project:(\S+)/);
        // project: の無い古い束は最上流宛て扱い
        return m ? m[1] === self.top : !self.upstream;
      })
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

function printOrder(path, legacy) {
  const text = readFileSync(path, "utf8");
  const waits = fields(text, "waiting_on").map(orderState);
  let state = legacy ? "open(legacy)" : "open";
  if (waits.length) state = waits.every((w) => w.state === "done") ? "resumable" : "waiting";
  console.log(`${state} ${path}\n  from: ${field(text, "from").split(" | ")[0]}\n  need: ${field(text, "need")}`);
  for (const w of waits) console.log(`  waiting_on: ${w.state} ${w.path}`);
}

const self = repoInfo(process.cwd());
if (!self) {
  console.error("not inside a git repository");
  process.exit(1);
}
const cmd = process.argv[2];

if (cmd === "self") {
  console.log(`self: ${self.repoId}\norigin: ${self.origin || "-"}\ntop: ${self.top}\nbox: ${boxOf(self.repoId)}\nroot: ${ROOT}`);
} else if (cmd === "repos") {
  for (const r of localRepos(self)) {
    const mark = r.repoId === self.repoId ? " (self)" : "";
    console.log(`repo: ${r.repoId}${mark}\n  url: ${r.origin || "-"}\n  path: ${r.paths.join(", ")}\n  rules: ${rulesPath(r.paths[0])}\n  box: ${boxOf(r.repoId)}`);
  }
} else if (cmd === "inbox") {
  console.log(`box: ${boxOf(self.repoId)}`);
  for (const p of mdFiles(boxOf(self.repoId))) printOrder(p, false);
  // 旧形式の直下の依頼は最上流（upstream リモートが無いリポ）宛て
  if (!self.upstream) for (const p of mdFiles(ROOT)) printOrder(p, true);
  for (const d of councilDirs(self)) console.log(`council ${d}`);
} else {
  console.error("usage: node mailbox.mjs self | repos | inbox");
  process.exit(1);
}
