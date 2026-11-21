// scripts/workflow/context/lib.mjs
//
// pnpm workflow context facts の部品。文脈のファイルの行ごとの事実を集める(/project-review と /meditate の材料)。読むだけ、判断しない。
// - collectTargets: 見るファイルと行の範囲(repo = このリポの自前の文脈、personal = 個人の 2 ファイル)
// - contentLines: 内容の行(frontmatter・囲みのコード・見出し・空行を除く)と、字下げで受け継ぐ優先の印
// - lineFacts: 1 行の事実(鍵・印・土台に同じ鍵・同じ字面・参照の実在・許可と環境の語)
// 共有の部品: ./lib.lines.mjs(pnpm workflow memory と共有)。規則と使い方: scripts/workflow/context/README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { ordersRoot } from "../../../.claude/skills/order/mailbox.mjs";
import { whoOwns } from "../../../src/lib/forkOwnership/who.mjs";
import { DANGER_KINDS, HOOK_KINDS, KINDS } from "../devcheck/lib.kinds.mjs";
import { checkRefs, claudeConfigDir, git, lineText, listShort, mainCheckout, repoTop, sameText, splitFrontmatter } from "./lib.lines.mjs";

export const RULES_DIR = ".claude/rules";
export const LINEAGE_FILE = ".claude/rules/lineage.md";
export const MARKER_FILES = [".claude/rules/shortcuts.md", ".claude/rules/term-aliases.md"];
export const FORK_MARKER = "<!-- fork entries below";
const EXCLUDED_DIRS = [".claude/rules/core/", ".claude/rules/items/"];

export class ContextError extends Error {}

/** 引数: --personal・--fetch だけ。ほかは ContextError */
export const parseArgs = (argv) => {
  const out = { personal: false, fetch: false };
  for (const a of argv) {
    if (a === "--personal") out.personal = true;
    else if (a === "--fetch") out.fetch = true;
    else throw new ContextError(`知らない引数: ${a}`);
  }
  return out;
};

// ---- 行 ----

/** 優先の印・依頼の印 */
export const PRIORITY_MARK = "(priority)";
const ORDER_MARK = /\(order: ([^)\s]+)\)/;

/** 行頭の鍵: `- key:` `key:` `> **KEY**:` `- key (priority):`(括弧の印は飛ばす)。無ければ null */
export const keyOf = (line) => {
  const m = line.match(/^\s*(?:>\s*)?(?:[-*]\s+)?(?:\*\*)?([A-Za-z][A-Za-z0-9_.-]*)(?:\*\*)?(?:\s*\([^)]*\))*\s*:(?:\s|$)/);
  return m ? m[1] : null;
};

/**
 * 内容の行: 空行・frontmatter・囲みのコード(``` / ~~~)・見出し(#)を除く。marked = 自分か、字下げで上にある行に (priority)
 * @param {string} text
 * @param {{ from?: number, to?: number }} [range] 見る行の範囲(1 始まり、両端を含む)
 * @returns {{ n: number, line: string, key: string | null, marked: boolean, order: string | null }[]}
 */
export const contentLines = (text, { from = 1, to = Infinity } = {}) => {
  const lines = text.split(/\r?\n/);
  const { frontLines } = splitFrontmatter(text);
  const out = [];
  const stack = []; // { indent, marked }
  let fence = null;
  lines.forEach((line, i) => {
    const n = i + 1;
    if (n <= frontLines) return;
    const fenceMark = line.match(/^\s*(```|~~~)/);
    if (fence) {
      if (fenceMark && fenceMark[1] === fence) fence = null;
      return;
    }
    if (fenceMark) {
      fence = fenceMark[1];
      return;
    }
    if (line.trim() === "" || /^\s*#/.test(line) || /^\s*<!--/.test(line)) return;
    const indent = line.match(/^\s*/)[0].length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const own = line.includes(PRIORITY_MARK);
    const marked = own || stack.some((s) => s.marked);
    stack.push({ indent, marked: own });
    if (n < from || n > to) return;
    out.push({ n, line, key: keyOf(line), marked, order: line.match(ORDER_MARK)?.[1] ?? null });
  });
  return out;
};

/** lineage.md の節 name の行の範囲(見出しの次から閉じの前まで)。無ければ null */
export const sectionRange = (text, name) => {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${name}`);
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.trim() === `<!-- end ${name} -->`);
  return { from: start + 2, to: end < 0 ? lines.length : end };
};

/** 祖先の節の名(lineage.md の ## 見出しのうち自分でない物) */
export const ancestorSections = (text, own) =>
  text
    .split(/\r?\n/)
    .map((l) => l.match(/^##\s+(\S+)\s*$/)?.[1])
    .filter((name) => name && name !== own);

/** 印の行の範囲(fork entries below の印の次から最後まで)。印が無ければ null */
export const belowMarker = (text) => {
  const i = text.split(/\r?\n/).findIndex((l) => l.startsWith(FORK_MARKER));
  return i < 0 ? null : { from: i + 2 };
};

// ---- 語 ----

/** 許可の語: devcheck の種類と危険な 3 つの名前と入口の命令 + 決まった語。環境の語: 決まった語 */
export const permissionWords = () => {
  const words = new Set(["db:push", "deploy", "dev server", "playwright"]);
  for (const [name, kind] of Object.entries(KINDS)) {
    words.add(name);
    if (kind.command) words.add(kind.command.split(" <")[0].replace(/ "<.*$/, ""));
  }
  for (const name of HOOK_KINDS) words.add(name);
  for (const [name, kind] of Object.entries(DANGER_KINDS)) {
    words.add(name);
    for (const entry of Object.values(kind.entries)) if (entry !== "-") words.add(entry);
  }
  return [...words];
};
export const ENV_WORDS = ["production", "staging", "NODE_ENV", "APP_ENV", ".env"];

const hasWord = (line, word) => {
  if (/^[A-Za-z0-9_-]+$/.test(word)) return new RegExp(`(^|[^A-Za-z0-9_-])${word.replace(/-/g, "\\-")}($|[^A-Za-z0-9_-])`, "i").test(line);
  return line.toLowerCase().includes(word.toLowerCase());
};

/** 行に当たる語の種類: perm・env */
export const wordsOf = (line, perm = permissionWords()) => {
  const out = [];
  if (perm.some((w) => hasWord(line, w))) out.push("perm");
  if (ENV_WORDS.some((w) => hasWord(line, w))) out.push("env");
  return out;
};

// ---- 依頼 ----

/** 依頼の状態: 受け箱のどれかに <id>.md = open、done/<id>.md = done、無ければ unknown(受け箱は git の外) */
export const orderState = (id, env = process.env) => {
  const { root } = ordersRoot(env);
  if (!existsSync(root)) return "unknown";
  const boxes = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() || d.isSymbolicLink()).map((d) => d.name);
  if (boxes.some((box) => existsSync(path.join(root, box, `${id}.md`)))) return "open";
  if (boxes.some((box) => existsSync(path.join(root, box, "done", `${id}.md`)))) return "done";
  return "unknown";
};

// ---- 見るファイル ----

const tracked = (top, dir) => (git(top, ["ls-files", "--", dir]) ?? "").split("\n").filter(Boolean);
const readAt = (abs) => (existsSync(abs) ? readFileSync(abs, "utf8") : null);

/**
 * 見るファイルと行の範囲。repo: whoOwns が own(fork が足した)か self と答える .claude/rules の物(core/・items/ を除く)、
 * lineage.md の自分の節、shortcuts.md・term-aliases.md の印より下。Tier1: core/・items/・lineage.md を除く .claude/rules の物を丸ごと。
 * personal: 本体のチェックアウトの CLAUDE.local.md と <設定の置き場>/CLAUDE.md
 * @returns {{ scope: "repo" | "personal", own: string | null, targets: { path: string, abs: string, owner: string, range: { from?: number, to?: number } }[] }}
 */
export const collectTargets = ({ cwd, env = process.env, personal = false, fetch = false }) => {
  const top = repoTop(cwd);
  if (personal) {
    const targets = [
      { path: "CLAUDE.local.md", abs: path.join(mainCheckout(cwd), "CLAUDE.local.md") },
      { path: "~/.claude/CLAUDE.md", abs: path.join(claudeConfigDir(env), "CLAUDE.md") },
    ]
      .filter((t) => existsSync(t.abs))
      .map((t) => ({ ...t, owner: "personal", range: {} }));
    return { scope: "personal", own: null, targets };
  }
  const files = tracked(top, RULES_DIR).filter((f) => f.endsWith(".md") && !EXCLUDED_DIRS.some((d) => f.startsWith(d)));
  const who = whoOwns(top, files, { fetch });
  if (who.status === "unverified") throw new ContextError(`持ち主が決まらない: ${who.reason}`);
  const own = who.ownerId ?? null;
  const at = (f) => path.join(top, f);
  if (who.status === "tier1") {
    const targets = files.filter((f) => f !== LINEAGE_FILE).map((f) => ({ path: f, abs: at(f), owner: "own", range: {} }));
    return { scope: "repo", own, targets };
  }
  const targets = [];
  for (const r of who.results) {
    const f = r.path;
    if (f === LINEAGE_FILE) {
      const range = sectionRange(readAt(at(f)) ?? "", own);
      if (range) targets.push({ path: f, abs: at(f), owner: "own", range });
    } else if (MARKER_FILES.includes(f)) {
      const range = belowMarker(readAt(at(f)) ?? "");
      if (range) targets.push({ path: f, abs: at(f), owner: "own", range });
    } else if (r.owner.tier === "fork") targets.push({ path: f, abs: at(f), owner: "own", range: {} });
    else if (r.evidence?.intake?.kind === "self") targets.push({ path: f, abs: at(f), owner: "self", range: {} });
  }
  return { scope: "repo", own, targets };
};

// ---- 土台の鍵 ----

/**
 * 土台の鍵の索引: CLAUDE.md・core のファイル・lineage.md の祖先の節(personal ではこのリポの自前の文脈も)。key → path:line[]
 */
export const baseIndex = ({ top, own, extra = [] }) => {
  const index = new Map();
  const add = (file, text, range) => {
    for (const l of contentLines(text, range)) if (l.key) index.set(l.key, [...(index.get(l.key) ?? []), `${file}:${l.n}`]);
  };
  const claude = readAt(path.join(top, "CLAUDE.md"));
  if (claude) add("CLAUDE.md", claude);
  for (const f of tracked(top, ".claude/rules/core/").filter((x) => x.endsWith(".md"))) add(f, readAt(path.join(top, f)) ?? "");
  const lineage = readAt(path.join(top, LINEAGE_FILE));
  if (lineage) for (const name of ancestorSections(lineage, own)) add(LINEAGE_FILE, lineage, sectionRange(lineage, name));
  for (const t of extra) add(t.path, readAt(t.abs) ?? "", t.range);
  return index;
};

// ---- 1 行の事実 ----

/** 1 行の事実。参照の core/x.md・items/… は .claude/rules からの道としても探す(CLAUDE.md RULES_FILES の書き方) */
export const lineFacts = ({ target, l, top, base, perm, env }) => {
  const at = `${target.path}:${l.n}`;
  const mark = l.order ? `order:${l.order}:${orderState(l.order, env)}` : l.marked ? "priority" : "-";
  const baseHits = l.key ? (base.get(l.key) ?? []).filter((x) => x !== at) : [];
  const same = sameText(lineText(l.line), top).filter((x) => x !== at);
  return { at, key: l.key ?? "-", mark, base: baseHits, same, refs: checkRefs(l.line, top, { alsoUnder: [RULES_DIR] }), words: wordsOf(l.line, perm) };
};

/** 全部の事実(facts.mjs の出力の元) */
export const collectFacts = ({ cwd, env = process.env, personal = false, fetch = false }) => {
  const top = repoTop(cwd);
  const { scope, own, targets } = collectTargets({ cwd, env, personal, fetch });
  // personal: このリポの自前の文脈も土台に入れる(個人の行とリポの行の食い違いも見えるように)
  const repo = personal ? collectTargets({ cwd, env, personal: false, fetch }) : null;
  const base = baseIndex({ top, own: repo ? repo.own : own, extra: repo ? repo.targets : [] });
  const perm = permissionWords();
  const files = targets.map((target) => {
    const lines = contentLines(readAt(target.abs) ?? "", target.range);
    return { target, lines: lines.map((l) => lineFacts({ target, l, top, base, perm, env })) };
  });
  return { scope, files };
};

const short = (xs) => (xs.length ? listShort(xs) : "-");

/** 1 行の出力 */
export const formatLine = (f) =>
  [
    f.at,
    `key:${f.key}`,
    `mark:${f.mark}`,
    `base:${short(f.base)}`,
    `same:${short(f.same)}`,
    `refs:${f.refs.exist}/${f.refs.total}${f.refs.gone.length ? ` gone:${listShort(f.refs.gone)}` : ""}`,
    `words:${f.words.length ? f.words.join(",") : "-"}`,
  ].join(" | ");

/** 動作の共通: ContextError は 1 行で exit 2 */
export const runAction = (fn) => {
  try {
    fn();
  } catch (e) {
    if (!(e instanceof ContextError)) throw e;
    console.error(e.message);
    process.exitCode = 2;
  }
};
