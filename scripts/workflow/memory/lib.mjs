// scripts/workflow/memory/lib.mjs
//
// pnpm workflow memory の部品。Claude Code の auto-memory(このリポの memo の置き場)を /meditate のために扱う。
// - memoryDir: 置き場を git の本体の道から決める(ワークツリーから走らせても本体と同じ置き場)
// - collectFacts: memo ごとの事実(type・引き継ぎの 4 項目・日付・参照の実在・リポに同じ行・索引)を集める。判断はしない
// - headerState / applyHeader: MEMORY.md の先頭の区画を正本(.claude/skills/meditate/header.md)と字面で比べる・戻す
// 規則と使い方: scripts/workflow/memory/README.md

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const INDEX_FILE = "MEMORY.md";
export const HEADER_SOURCE = ".claude/skills/meditate/header.md";
export const HEADER_START = "<!-- meditate:header";
export const HEADER_END = "<!-- /meditate:header -->";
export const HANDOFF_KEYS = ["state", "next", "end", "date"];
const SAME_MIN_CHARS = 20;
const LIST_MAX = 3;

export class MemoryError extends Error {}

const git = (cwd, args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

/** このリポの今の作業木の根(git の外なら cwd) */
export const repoTop = (cwd) => git(cwd, ["rev-parse", "--show-toplevel"]) ?? cwd;

/** 本体のチェックアウトの道: git の共有の .git の親(ワークツリーでも本体を指す)。git の外なら cwd */
export const mainCheckout = (cwd) => {
  const common = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return common ? path.dirname(common) : cwd;
};

/** Claude Code がプロジェクトの道から作るフォルダ名(英数字以外を - に) */
export const projectDirName = (p) => p.replace(/[^A-Za-z0-9]/g, "-");

/** memo の置き場。dirFlag(--dir)が先、無ければ <CLAUDE_CONFIG_DIR か ~/.claude>/projects/<本体の道の名>/memory */
export const memoryDir = ({ cwd, env = process.env, dirFlag } = {}) => {
  if (dirFlag) return path.resolve(cwd, dirFlag);
  const config = env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude");
  return path.join(config, "projects", projectDirName(mainCheckout(cwd)), "memory");
};

/** 引数: --dir <path> と --apply だけ。ほかは MemoryError */
export const parseArgs = (argv, { allowApply = false } = {}) => {
  const out = { dir: undefined, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" && argv[i + 1]) out.dir = argv[++i];
    else if (a.startsWith("--dir=")) out.dir = a.slice(6);
    else if (allowApply && a === "--apply") out.apply = true;
    else throw new MemoryError(`知らない引数: ${a}`);
  }
  return out;
};

/** frontmatter と本文に分ける(frontmatter が無ければ空) */
export const splitFrontmatter = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? { front: m[1], body: text.slice(m[0].length) } : { front: "", body: text };
};

/** frontmatter の鍵(metadata の下の字下げも、古い形の最上位も)。最初に当たった値 */
const frontValue = (front, key) => {
  const m = front.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};

/** 本文の `<key>:` の行(行頭の - や ** は飛ばす) */
const bodyLine = (body, key) => {
  const m = body.match(new RegExp(`^\\s*(?:[-*]\\s+)?(?:\\*\\*)?${key}(?:\\*\\*)?\\s*:\\s*(.+)$`, "im"));
  return m ? m[1].trim() : null;
};

const ymd = (s) => s?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

/** 本文からパスらしい語(/ を含み、拡張子か ~/ / ./ ../ / の始まりか / の終わり)。URL と仮の名(<> *)は除く */
export const pathRefs = (body) => {
  const text = body.replace(/https?:\/\/\S+/g, " ");
  const found = new Set();
  for (const m of text.matchAll(/(?:~\/|\.{1,2}\/|\/)?[\w.@\-[\]()!+]+(?:\/[\w.@\-[\]()!+]+)+\/?/g)) {
    let p = m[0].replace(/[.,:;)]+$/, "");
    if (/[<>*]/.test(p) || !p.includes("/")) continue;
    const marked = /^(~\/|\.{1,2}\/|\/)/.test(p) || p.endsWith("/") || /\.[A-Za-z0-9]{1,6}$/.test(p);
    if (marked) found.add(p);
  }
  return [...found];
};

/** 本文からコミットらしい語(7〜40 桁の 16 進で、数字と a-f の両方を含む) */
export const commitRefs = (body) => {
  const found = new Set();
  for (const m of body.matchAll(/\b[0-9a-f]{7,40}\b/g)) if (/\d/.test(m[0]) && /[a-f]/.test(m[0])) found.add(m[0]);
  return [...found];
};

const resolveRef = (p, top) => (p.startsWith("~/") ? path.join(homedir(), p.slice(2)) : path.isAbsolute(p) ? p : path.join(top, p));

/** 参照の実在: 在る数・全数・無い物 */
export const checkRefs = (body, top) => {
  const gone = [];
  let total = 0;
  for (const p of pathRefs(body)) {
    total++;
    if (!existsSync(resolveRef(p, top))) gone.push(p);
  }
  for (const c of commitRefs(body)) {
    total++;
    if (git(top, ["cat-file", "-e", `${c}^{commit}`]) === null) gone.push(c);
  }
  return { exist: total - gone.length, total, gone };
};

/** 本文の 20 字以上の行と同じ行を持つリポの追跡ファイル(path:line) */
export const sameLines = (body, top) => {
  const hits = new Set();
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:#+|[-*]|\d+\.)\s+/, "").trim())
    .filter((l) => [...l].length >= SAME_MIN_CHARS);
  for (const l of new Set(lines)) {
    const out = git(top, ["grep", "-F", "-n", "-I", "-e", l]);
    if (out) for (const row of out.split("\n")) hits.add(row.split(":").slice(0, 2).join(":"));
  }
  return [...hits];
};

/** MEMORY.md の中の ](name.md) の名(同じフォルダの物だけ) */
export const indexLinks = (indexText) => {
  const names = new Set();
  for (const m of indexText.matchAll(/\]\(([^)\s/]+\.md)\)/g)) names.add(decodeURIComponent(m[1]));
  return names;
};

/** memo 1 件の事実 */
export const memoFacts = ({ dir, file, top, indexed }) => {
  const full = path.join(dir, file);
  const { front, body } = splitFrontmatter(readFileSync(full, "utf8"));
  const type = frontValue(front, "type") ?? "-";
  const handoff = HANDOFF_KEYS.map((k) => ((bodyLine(body, k) ?? frontValue(front, k)) ? k : "-"));
  const meta = ymd(frontValue(front, "modified"));
  const written = ymd(bodyLine(body, "date"));
  const date = meta ? `${meta}(meta)` : written ? `${written}(body)` : `${statSync(full).mtime.toISOString().slice(0, 10)}(mtime)`;
  return { file, type, handoff, date, refs: checkRefs(body, top), same: sameLines(body, top), index: indexed.has(file) };
};

/** 置き場の memo の一覧(MEMORY.md を除く、直下の .md だけ) */
export const listMemos = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md") && d.name !== INDEX_FILE)
    .map((d) => d.name)
    .sort();

/** 正本の区画(印の行を含む)。無ければ MemoryError */
export const readHeaderSource = (top) => {
  const file = path.join(top, HEADER_SOURCE);
  if (!existsSync(file)) throw new MemoryError(`正本がありません: ${HEADER_SOURCE}`);
  const block = findBlock(readFileSync(file, "utf8"));
  if (block.state !== "found") throw new MemoryError(`正本の印が読めません: ${HEADER_SOURCE}`);
  return block.text;
};

/** 文の中の区画: found(text・start・end の行番号)| missing | broken(印が片方だけ・2 つ以上) */
export const findBlock = (text) => {
  const lines = text.split("\n");
  const starts = lines.flatMap((l, i) => (l.startsWith(HEADER_START) ? [i] : []));
  const ends = lines.flatMap((l, i) => (l.trim() === HEADER_END ? [i] : []));
  if (!starts.length && !ends.length) return { state: "missing" };
  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) return { state: "broken" };
  return { state: "found", start: starts[0], end: ends[0], text: lines.slice(starts[0], ends[0] + 1).join("\n") };
};

/** MEMORY.md の区画の状態: ok | missing | differs | broken | no-index */
export const headerState = (dir, source) => {
  const file = path.join(dir, INDEX_FILE);
  if (!existsSync(file)) return { state: "no-index" };
  const block = findBlock(readFileSync(file, "utf8"));
  if (block.state !== "found") return { state: block.state };
  return { state: block.text === source ? "ok" : "differs", current: block.text };
};

/** 区画を正本に戻した MEMORY.md の文(区画の外は変えない。無ければ先頭に足す、索引が無ければ区画だけ) */
export const withHeader = (indexText, source) => {
  if (indexText === null) return `${source}\n`;
  const block = findBlock(indexText);
  if (block.state === "broken") throw new MemoryError(`${INDEX_FILE} の区画の印が壊れています(片方だけか 2 つ以上)。手で直してから走らせてください`);
  if (block.state === "missing") return `${source}\n\n${indexText}`;
  const lines = indexText.split("\n");
  return [...lines.slice(0, block.start), source, ...lines.slice(block.end + 1)].join("\n");
};

/** 区画を書く。書いたら true、もう同じなら false */
export const applyHeader = (dir, source) => {
  const file = path.join(dir, INDEX_FILE);
  const before = existsSync(file) ? readFileSync(file, "utf8") : null;
  const after = withHeader(before, source);
  if (after === before) return false;
  writeFileSync(file, after);
  return true;
};

/** 置き場全体の事実(facts.mjs の出力の元) */
export const collectFacts = ({ cwd, env, dirFlag }) => {
  const top = repoTop(cwd);
  const dir = memoryDir({ cwd, env, dirFlag });
  if (!existsSync(dir)) return { dir, exists: false };
  const source = readHeaderSource(top);
  const indexFile = path.join(dir, INDEX_FILE);
  const indexed = existsSync(indexFile) ? indexLinks(readFileSync(indexFile, "utf8")) : new Set();
  const memos = listMemos(dir);
  return {
    dir,
    exists: true,
    header: headerState(dir, source).state,
    memos: memos.map((file) => memoFacts({ dir, file, top, indexed })),
    indexOnly: [...indexed].filter((n) => !memos.includes(n)).sort(),
  };
};

const list = (xs) => xs.slice(0, LIST_MAX).join(",") + (xs.length > LIST_MAX ? ",…" : "");

/** memo 1 件の 1 行 */
export const formatMemo = (m) =>
  [
    m.file,
    `type:${m.type}`,
    `handoff:${m.handoff.join(",")}`,
    `date:${m.date}`,
    `refs:${m.refs.exist}/${m.refs.total}${m.refs.gone.length ? ` gone:${list(m.refs.gone)}` : ""}`,
    `same:${m.same.length}${m.same.length ? ` ${list(m.same)}` : ""}`,
    `index:${m.index ? "yes" : "no"}`,
  ].join(" | ");

/** 動作の共通: MemoryError は 1 行で exit 2 */
export const runAction = (fn) => {
  try {
    fn();
  } catch (e) {
    if (!(e instanceof MemoryError)) throw e;
    console.error(e.message);
    process.exitCode = 2;
  }
};
