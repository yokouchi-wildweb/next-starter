// scripts/workflow/memory/lib.mjs
//
// pnpm workflow memory の部品。Claude Code の auto-memory(このリポの memo の置き場)を /meditate のために扱う。
// - memoryDir: 置き場を git の本体の道から決める(ワークツリーから走らせても本体と同じ置き場)
// - 参照の実在・同じ行・frontmatter・道の部品は ../context/lib.lines.mjs と共有(pnpm workflow context facts も使う)
// - collectFacts: memo ごとの事実(type・引き継ぎの 4 項目・日付・参照の実在・リポに同じ行・索引)を集める。判断はしない
// - headerState / applyHeader: MEMORY.md の先頭の区画を正本(.claude/skills/meditate/header.md)と字面で比べる・戻す
// 規則と使い方: scripts/workflow/memory/README.md

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { checkRefs, claudeConfigDir, listShort, mainCheckout, repoTop, sameLines, splitFrontmatter } from "../context/lib.lines.mjs";

export const INDEX_FILE = "MEMORY.md";
export const HEADER_SOURCE = ".claude/skills/meditate/header.md";
export const HEADER_START = "<!-- meditate:header";
export const HEADER_END = "<!-- /meditate:header -->";
export const HANDOFF_KEYS = ["state", "next", "end", "date"];

export class MemoryError extends Error {}

/** Claude Code がプロジェクトの道から作るフォルダ名(英数字以外を - に) */
export const projectDirName = (p) => p.replace(/[^A-Za-z0-9]/g, "-");

/** memo の置き場。dirFlag(--dir)が先、無ければ <CLAUDE_CONFIG_DIR か ~/.claude>/projects/<本体の道の名>/memory */
export const memoryDir = ({ cwd, env = process.env, dirFlag } = {}) => {
  if (dirFlag) return path.resolve(cwd, dirFlag);
  return path.join(claudeConfigDir(env), "projects", projectDirName(mainCheckout(cwd)), "memory");
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

/** memo 1 件の 1 行 */
export const formatMemo = (m) =>
  [
    m.file,
    `type:${m.type}`,
    `handoff:${m.handoff.join(",")}`,
    `date:${m.date}`,
    `refs:${m.refs.exist}/${m.refs.total}${m.refs.gone.length ? ` gone:${listShort(m.refs.gone)}` : ""}`,
    `same:${m.same.length}${m.same.length ? ` ${listShort(m.same)}` : ""}`,
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
