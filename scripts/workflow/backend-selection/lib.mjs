// scripts/workflow/backend-selection/lib.mjs
//
// pnpm workflow backend-selection の部品。根の backend-selection.json(口 → 実装の名前、型 5 self)を埋める・選ぶ・見る。
// 口・選べる名前・任意か・今の設定の読み方(compat)は選ぶ点の宣言から(planExtensions、scripts/structure/extensions)。
// 止める判定は持たない: 書いてから planExtensions を回し、書く前に無かった問題が出たら元に戻して止める(生成器の検査が唯一の判定)。
// env は手元の .env・.env.development・.env.production だけを読み(Vercel は読まない、D37)、値はどこにも出さない(名前だけ)。
// 規則と使い方: scripts/workflow/backend-selection/README.md

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { isSelectPoint, readBackendDeclaration } from "../../../src/lib/districtMap/index.mjs";
import { readForkIdentity } from "../../../src/lib/forkOwnership/node.mjs";
import { planExtensions } from "../../structure/extensions/extensions.mjs";
import { SELECTION_FILE, readReservedNames } from "../../structure/extensions/select.mjs";

/** fill が読む手元の env のファイル(この順に読み、名前だけを出す) */
export const ENV_FILES = [".env", ".env.development", ".env.production"];
/** fill の前提: 先に取る区切り(D31) */
export const RENAME_SEGMENT = "district-stage1";
/** 改名の区切りの notice(checkpoint district-stage1、moved: の本体。-base-arg / -ud-config はそれを直す後追い) */
export const RENAME_NOTICE = "20261122-180722-district-stage1";
export const SHELF_NOTICE = "20261124-033209-flux-rebuild";
const SHELF_SEGMENT = "flux-rebuild";
const SET_LINE = (port, name = "<名前>") => `pnpm workflow backend-selection set ${port} ${name}`;

export class BackendSelectionError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "BackendSelectionError";
  }
}

/** 動作の入口: BackendSelectionError は 1 行で出して終了コード 2(何も書いていない) */
export const runAction = (/** @type {(args: string[]) => void} */ fn) => {
  try {
    fn(process.argv.slice(2).filter((a) => a !== "--"));
  } catch (error) {
    if (error instanceof BackendSelectionError) {
      console.error(`backend-selection: ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
};

/** 既定の生成: pnpm generate extensions(リポ直下で) */
export const runGenerate = (/** @type {string} */ root) => {
  const r = spawnSync("pnpm", ["generate", "extensions"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) throw new BackendSelectionError("pnpm generate extensions が失敗した(上の出力を見て直す)");
};

/**
 * 選ぶ点の事実: 口 → { 任意か, compat, 選べる名前(項目の名前), 点 }
 * @param {string} root
 */
export function selectionFacts(root) {
  const plan = planExtensions(root);
  /** @type {Map<string, { optional: boolean, compat: any, names: string[], points: any[] }>} */
  const ports = new Map();
  for (const p of plan.points.filter((point) => isSelectPoint(point.spec))) {
    const port = p.spec.select.port;
    const entry = ports.get(port) ?? { optional: true, compat: p.spec.select.compat, names: [], points: [] };
    entry.optional &&= p.spec.select.optional === true;
    entry.points.push(p);
    for (const item of plan.itemsByPoint.get(p) ?? []) if (!entry.names.includes(item.name)) entry.names.push(item.name);
    entry.names.sort();
    ports.set(port, entry);
  }
  return { plan, ports };
}

/** @param {string} root */
const tableFile = (root) => path.join(root, SELECTION_FILE);

/**
 * 今の選択表(無い = null)。読めない形は止める
 * @param {string} root
 * @returns {Record<string, string> | null}
 */
export function readTable(root) {
  if (!existsSync(tableFile(root))) return null;
  let value;
  try {
    value = JSON.parse(readFileSync(tableFile(root), "utf8"));
  } catch {
    throw new BackendSelectionError(`${SELECTION_FILE} が JSON として読めない(直してからもう一度)`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new BackendSelectionError(`${SELECTION_FILE} は { "<口>": "<実装の名前>" } の object`);
  return value;
}

/** 鍵の順に 2 字下げで書く */
export const formatTable = (/** @type {Record<string, string>} */ table) =>
  `${JSON.stringify(Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 2)}\n`;

/**
 * 表を書き、生成器の検査を回す。書く前に無かった問題が出たら元に戻して止める(判定は planSelection だけが持つ)。
 * 書く前からある問題は警告として返す(命令のせいにしない)
 * @param {string} root
 * @param {Record<string, string>} table
 * @returns {{ warnings: string[] }}
 */
export function writeChecked(root, table) {
  const before = existsSync(tableFile(root)) ? readFileSync(tableFile(root), "utf8") : null;
  const problemsBefore = new Set(planExtensions(root).problems);
  writeFileSync(tableFile(root), formatTable(table));
  const after = planExtensions(root).problems;
  const added = after.filter((p) => !problemsBefore.has(p));
  if (added.length > 0) {
    if (before === null) rmSync(tableFile(root));
    else writeFileSync(tableFile(root), before);
    throw new BackendSelectionError(`書くと止まるので戻した(${added.length} 件):\n${added.map((p) => `  - ${p}`).join("\n")}`);
  }
  return { warnings: after.filter((p) => problemsBefore.has(p)) };
}

/**
 * env のファイル 1 つを読む(KEY=VALUE。# の行・空行は飛ばす、export 付き・引用符も読む)
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseEnvFile(text) {
  const values = new Map();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    values.set(match[1], value);
  }
  return values;
}

/**
 * 手元の env のファイル(在る物だけ)
 * @param {string} root
 * @returns {{ file: string, values: Map<string, string> }[]}
 */
export const readEnvFiles = (root) =>
  ENV_FILES.filter((f) => existsSync(path.join(root, f))).map((file) => ({ file, values: parseEnvFile(readFileSync(path.join(root, file), "utf8")) }));

/**
 * compat から口の実装の名前を読む。値は返さない(名前と理由だけ)
 * @param {any} compat
 * @param {{ file: string, values: Map<string, string> }[]} envFiles
 * @returns {{ name: string } | { problem: string }}
 */
export function nameFromCompat(compat, envFiles) {
  if (compat.from === "fixed") return { name: compat.value };
  /** @type {Map<string, string[]>} 読んだ名前 → それを出したファイル */
  const seen = new Map();
  for (const { file, values } of envFiles) {
    const raw = (values.get(compat.name) ?? "").trim();
    let name;
    if (raw === "") name = compat.default;
    else if (Object.hasOwn(compat.map, raw)) name = compat.map[raw];
    else return { problem: `${file} の ${compat.name} の値が compat.map(${Object.keys(compat.map).join(", ")})のどれでもない` };
    seen.set(name, [...(seen.get(name) ?? []), file]);
  }
  if (seen.size === 0) return { name: compat.default };
  if (seen.size > 1) return { problem: `${compat.name} から読む実装がファイルの間で違う(${[...seen.entries()].map(([n, files]) => `${files.join("・")} → ${n}`).join(" / ")})` };
  return { name: [...seen.keys()][0] };
}

/**
 * 本番の確かめの行(D37)。値 = 選んだ名前になる compat.map の鍵(宣言の字面)か「未設定」。手元の env の値は出さない
 * @param {any} compat
 * @param {string} name
 */
export function productionLine(compat, name) {
  const keys = Object.entries(compat.map).filter(([, v]) => v === name).map(([k]) => k);
  const ways = [...keys, ...(compat.default === name ? ["未設定"] : [])];
  return `本番(Vercel)の ${compat.name} が ${ways.join(" か ")} か確かめる(違えば build が止まる)`;
}

/**
 * 台帳の行に notice の id があるか(台帳の形 `- id:<id> | …`。別の id の頭にだけ当たる物は数えない)
 * @param {string} text
 * @param {string} id
 */
const ledgerHas = (text, id) => new RegExp(`(^|[^A-Za-z0-9_-])id:${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_-])`, "m").test(text);

/**
 * fill の前提(D31・D46): Tier1 でなければ台帳 .notices/applied/<repo_id>.md に、改名の区切りの notice と棚 05 S2 の notice の行
 * (足りない最初の区切りを名指して止める。木の形は見ない: 古いフォルダの名前をコードに残さない)
 * @param {string} root
 */
export function checkPreconditions(root) {
  const identity = readForkIdentity(root);
  if (identity.tier === "root") return;
  const ledgerName = `.notices/applied/${identity.own ?? "<repo_id>"}.md`;
  const ledgerPath = path.join(root, ".notices/applied", `${identity.own}.md`);
  const text = identity.own && existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : "";
  for (const [id, segment] of [[RENAME_NOTICE, RENAME_SEGMENT], [SHELF_NOTICE, SHELF_SEGMENT]]) {
    if (!ledgerHas(text, id)) throw new BackendSelectionError(`台帳 ${ledgerName} に ${id} が無い。先に区切り ${segment} を /flux で取る`);
  }
}

/**
 * 生成の後の差分のうち、選択表と生成物でない物(git の無い木では null)
 * @param {string} root
 * @param {Set<string>} generated 生成物のパス
 */
export function otherChanges(root, generated) {
  const r = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter((p) => p !== SELECTION_FILE && !generated.has(p));
}

/**
 * fill(D31): 足りない鍵だけ compat で読んで書き、生成する。何度流しても同じ
 * @param {string} root
 * @param {{ generate?: (root: string) => void, log?: (line: string) => void }} [options]
 * @returns {{ written: Record<string, string>, questions: string[] }}
 */
export function fill(root, { generate = runGenerate, log = console.log } = {}) {
  checkPreconditions(root);
  const current = readTable(root);
  const { ports } = selectionFacts(root);
  const table = { ...(current ?? {}) };
  /** @type {Record<string, string>} */
  const written = {};
  /** @type {string[]} */
  const questions = [];
  const envFiles = readEnvFiles(root);
  for (const [port, facts] of [...ports.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (table[port] !== undefined) continue;
    const read = nameFromCompat(facts.compat, envFiles);
    if ("problem" in read) {
      questions.push(`口 ${port}: ${read.problem}。どれを使うか決めて ${SET_LINE(port)}(選べる名前: ${[...facts.names, ...(facts.optional ? ["none"] : [])].join(", ")})`);
      continue;
    }
    table[port] = read.name;
    written[port] = read.name;
  }
  if (current !== null && Object.keys(written).length === 0) {
    for (const q of questions) log(q);
    log(Object.keys(table).length === Object.keys(current).length && questions.length === 0 ? `${SELECTION_FILE}: 足りない鍵は無い(書いていない)` : `${SELECTION_FILE}: 書いた鍵は無い`);
    return { written, questions };
  }
  const { warnings } = writeChecked(root, table);
  for (const w of warnings) log(`warn(書く前からある問題): ${w}`);
  log(`${SELECTION_FILE}: ${Object.keys(written).length === 0 ? "{} を作った" : Object.entries(written).map(([p, n]) => `${p} = ${n}`).join(", ")}`);
  generate(root);
  const outputs = new Set([...Object.keys(planExtensions(root).outputs), "src/lib/forkOwnership/intake.txt"]);
  const others = otherChanges(root, outputs);
  if (others !== null) log(others.length === 0 ? "差分は選択表と生成物だけ" : `選択表と生成物でない差分がある(見てからコミット): ${others.join(", ")}`);
  for (const [port, name] of Object.entries(written)) {
    const compat = ports.get(port)?.compat;
    if (compat?.from === "env") log(productionLine(compat, name));
  }
  for (const q of questions) log(q);
  return { written, questions };
}

/**
 * set <口> <名前>: 書いて生成する(止める判定は生成器の検査)
 * @param {string} root
 * @param {string} port
 * @param {string} name
 * @param {{ generate?: (root: string) => void, log?: (line: string) => void }} [options]
 */
export function setSelection(root, port, name, { generate = runGenerate, log = console.log } = {}) {
  const table = { ...(readTable(root) ?? {}), [port]: name };
  const { warnings } = writeChecked(root, table);
  for (const w of warnings) log(`warn(書く前からある問題): ${w}`);
  log(`${SELECTION_FILE}: ${port} = ${name}`);
  generate(root);
}

/**
 * show: 表・口ごとの選べる名前・選んだ実装の足りない env の名前(手元の 3 つのファイルのどれでも空。値は出さない)
 * @param {string} root
 * @returns {string[]}
 */
export function show(root) {
  const table = readTable(root);
  const { plan, ports } = selectionFacts(root);
  const reserved = readReservedNames(root);
  const none = "problem" in reserved ? "none" : reserved.none;
  const envFiles = readEnvFiles(root);
  const lines = [`${SELECTION_FILE}: ${table === null ? "無い(pnpm workflow backend-selection fill で作る)" : JSON.stringify(table)}`];
  if (ports.size === 0) lines.push("選ぶ点: なし");
  for (const [port, facts] of [...ports.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const chosen = table?.[port];
    lines.push(`- ${port}: 選んだ実装 ${chosen ?? "(鍵が無い)"} | 選べる名前 ${[...facts.names, ...(facts.optional ? [none] : [])].join(", ") || "なし"}`);
    if (!chosen || chosen === none) continue;
    const required = new Set();
    for (const p of facts.points) {
      const item = (plan.itemsByPoint.get(p) ?? []).find((i) => i.name === chosen);
      const declaration = item ? readBackendDeclaration(item.path, item.text).declaration : undefined;
      for (const env of declaration?.env.required ?? []) required.add(env);
    }
    const missing = [...required].filter((env) => envFiles.every(({ values }) => (values.get(env) ?? "").trim() === "")).sort();
    lines.push(`  足りない env(手元の ${ENV_FILES.join("・")} のどれでも空): ${missing.join(", ") || "なし"}`);
  }
  return lines;
}
