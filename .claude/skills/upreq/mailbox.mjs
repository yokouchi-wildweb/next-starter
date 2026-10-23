#!/usr/bin/env node
// 上流依頼メールボックスの補助スクリプト（/upreq・/inbox・/wen 共通）
// 置き場: $TEAM_UPSTREAM_REQUESTS（既定 ~/.team/upstream-requests）
//   <root>/<fork-id>/*.md      = そのリポ宛ての未対応チケット
//   <root>/<fork-id>/done/*.md = 対応済み
//   <root>/*.md, <root>/done/*.md = 旧形式（宛先欄なし = 最上流宛て）。移し替えまでの互換
//   <root>/edict-*/, <root>/legate-*/ = council の束（00-index.md の project: で宛先を判定）
// 使い方:
//   node mailbox.mjs self          自リポの fork-id と受信箱
//   node mailbox.mjs chain         自リポから最上流までの祖先（宛先候補）
//   node mailbox.mjs inbox         自リポ宛ての未対応チケット一覧
//   node mailbox.mjs mine [--all]  自リポが出した依頼（既定: 未対応 + 7 日以内の対応済み）
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

const ROOT = process.env.TEAM_UPSTREAM_REQUESTS || join(homedir(), ".team", "upstream-requests");
const RECENT_DAYS = 7;

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
  const forkId = origin ? forkIdFromUrl(origin) : `local--${basename(top).toLowerCase()}`;
  return { top, origin, upstream, forkId };
}

// TIER 節の書式は fork ごとに異なるので、解釈はせず読む場所だけ返す
function rulesPath(top) {
  const file = join(top, ".claude", "rules", "project.md");
  return existsSync(file) ? file : "-";
}

// 祖先の手元 checkout を、既知リポの親ディレクトリ（兄弟）から origin の fork-id で探す
function findCheckout(forkId, searchDirs) {
  for (const parent of searchDirs) {
    let entries = [];
    try {
      entries = readdirSync(parent, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const dir = join(parent, e.name);
      if (!existsSync(join(dir, ".git"))) continue;
      const origin = git(dir, ["remote", "get-url", "origin"]);
      if (origin && forkIdFromUrl(origin) === forkId) return dir;
    }
  }
  return null;
}

function boxOf(forkId) {
  return join(ROOT, forkId);
}

function chain(self) {
  const ancestors = [];
  const searchDirs = new Set([dirname(self.top)]);
  let cur = self;
  let end = "root";
  const seen = new Set([self.forkId]);
  while (cur.upstream) {
    const forkId = forkIdFromUrl(cur.upstream);
    if (seen.has(forkId)) {
      end = "cycle";
      break;
    }
    seen.add(forkId);
    const path = findCheckout(forkId, searchDirs);
    if (!path) {
      ancestors.push({ forkId, url: cur.upstream, path: "-", rules: "-", box: boxOf(forkId) });
      end = "not-cloned";
      break;
    }
    searchDirs.add(dirname(path));
    const info = repoInfo(path);
    ancestors.push({ forkId, url: cur.upstream, path, rules: rulesPath(path), box: boxOf(forkId) });
    cur = info;
  }
  return { ancestors, end };
}

function field(text, name) {
  const line = text.split("\n").find((l) => l.startsWith(`${name}:`));
  return line ? line.slice(name.length + 1).trim() : "";
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

function boxDirs() {
  try {
    return readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.includes("--"))
      .map((e) => join(ROOT, e.name))
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

// 対応日時 = 最後の RESOLUTION の resolved:（ファイルの mtime は一括移動などで変わるので使わない）
function resolvedAt(path) {
  const stamps = [...readFileSync(path, "utf8").matchAll(/^resolved:\s*(\S+)/gm)].map((m) => Date.parse(m[1]));
  const last = stamps.filter((t) => !Number.isNaN(t)).pop();
  return last ?? statSync(path).mtimeMs;
}

function printTicket(state, path) {
  const text = readFileSync(path, "utf8");
  const from = field(text, "from").split(" | ")[0];
  const to = field(text, "to").split(" | ")[0] || "(legacy: top)";
  console.log(`${state} ${path}\n  from: ${from}\n  to: ${to}\n  need: ${field(text, "need")}`);
}

const self = repoInfo(process.cwd());
if (!self) {
  console.error("not inside a git repository");
  process.exit(1);
}
const cmd = process.argv[2];
const isTop = !self.upstream;

if (cmd === "self") {
  console.log(`self: ${self.forkId}\norigin: ${self.origin || "-"}\nupstream: ${self.upstream || "- (top of chain)"}\ntop: ${self.top}\nbox: ${boxOf(self.forkId)}\nroot: ${ROOT}`);
} else if (cmd === "chain") {
  const { ancestors, end } = chain(self);
  console.log(`self: ${self.forkId}\n  rules: ${rulesPath(self.top)}`);
  ancestors.forEach((a, i) => {
    console.log(`ancestor ${i + 1}: ${a.forkId}\n  url: ${a.url}\n  path: ${a.path}\n  rules: ${a.rules}\n  box: ${a.box}`);
  });
  console.log(`chain_end: ${end}`);
  if (end === "not-cloned") console.log("note: the last ancestor has no local checkout, so ancestors above it are unknown");
} else if (cmd === "inbox") {
  console.log(`box: ${boxOf(self.forkId)}`);
  for (const p of mdFiles(boxOf(self.forkId))) printTicket("open", p);
  if (isTop) for (const p of mdFiles(ROOT)) printTicket("open(legacy)", p);
  for (const d of councilDirs(self)) console.log(`council ${d}`);
} else if (cmd === "mine") {
  const all = process.argv.includes("--all");
  const since = Date.now() - RECENT_DAYS * 86400000;
  const dirs = [...boxDirs(), ROOT];
  const mine = (p) => self.origin && field(readFileSync(p, "utf8"), "from").startsWith(self.origin);
  for (const d of dirs) {
    for (const p of mdFiles(d)) if (mine(p)) printTicket("open", p);
    for (const p of mdFiles(join(d, "done"))) {
      if (!mine(p)) continue;
      if (all || resolvedAt(p) >= since) printTicket("done", p);
    }
  }
} else {
  console.error("usage: node mailbox.mjs self | chain | inbox | mine [--all]");
  process.exit(1);
}
