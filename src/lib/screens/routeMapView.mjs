// src/lib/screens/routeMapView.mjs
// ルート地図(route-map.jsonl の行)を人やエージェント向けに絞り込み・描画する(pnpm check routes -- show の中身)。
// 地図の形は routeMap.mjs が持つ。ここは読むだけで、形を変えない。
// 設計: src/lib/screens/README.md §13「見る」
import { formatRouteDetails, formatRouteMap } from "./routeMap.mjs";

/**
 * @import { GuardStage, RouteMapRow, RouteMapStage } from "./routeMap.mjs"
 * @typedef {Extract<RouteMapStage, { kind: "loader" }>} LoaderStage
 */

const APP_DIR = "src/app";
const VIEWS = ["details", "tree", "table", "mermaid", "jsonl"];
const STATES = ["verified", "gated-off", "live"];

export const SHOW_USAGE = `使い方: pnpm check routes -- show [<URL 接頭辞>] [オプション]

  <URL 接頭辞>        URL のセグメント単位で絞る(/admin は /admin・/admin/** に一致し、/administrator には一致しない)
  --view=<形>         details(既定。段ごとの鎖) | tree(URL の木) | table(Markdown の表) | mermaid(guard の範囲の図) | jsonl(絞った行をそのまま)
  --scope=<範囲>      guard.ts の範囲で絞る。書き方: admin/(protected) | src/app/admin/(protected) | /(root)。その範囲と配下の範囲のページ
  --nearest           --scope を最寄りの guard.ts だけで判定する(配下の範囲を含めない)
  --access=<値>       loader の access で絞る: public | authenticated | role:<名前> | category:<名前> | registry[:<domain>[.<op>]] | statuses(allowStatuses を書いたページ)
  --state=<状態>      verified | gated-off(feature-gate で止めている) | live(止めていない)
  --file=<path>       src/app から作り直さず、地図ファイル(JSON Lines)を読む
  --help              この説明

同じオプションを重ねると「または」、別のオプションどうしは「かつ」。
( ) を含む値はシェルで '…' で囲む(例 --scope='admin/(protected)')。
`;

/**
 * guard.ts の file → 範囲の名前("/" = root、それ以外は src/app からの相対ディレクトリ)
 * @param {string} guardFile
 * @returns {string}
 */
export function rangeOf(guardFile) {
  const dir = guardFile.slice(0, guardFile.lastIndexOf("/"));
  return dir === APP_DIR ? "/" : dir.slice(APP_DIR.length + 1);
}

/**
 * --scope の書き方を範囲の名前にそろえる
 * @param {string} value
 * @returns {string}
 */
export function normalizeScope(value) {
  let s = value.trim().replace(/\/guard\.ts$/, "").replace(/\/+$/, "");
  if (s === APP_DIR || s === "" || s === "root") return "/";
  if (s.startsWith(`${APP_DIR}/`)) s = s.slice(APP_DIR.length + 1);
  return s.replace(/^\/+/, "");
}

const ACCESS_TOKEN = /^(public|authenticated|statuses|registry(:[\w.-]+)?|role:[\w-]+|category:[\w-]+)$/;

/**
 * pnpm check routes -- show の引数(show の後ろ)を読む。
 * @param {string[]} argv
 * @returns {{ ok: true, opts: ShowOptions } | { ok: false, error: string }}
 */
export function parseShowArgs(argv) {
  /** @type {ShowOptions} */
  const opts = { prefix: null, view: "details", scopes: [], nearest: false, access: [], states: [], file: null, help: false };
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      if (opts.prefix !== null) return { ok: false, error: `URL 接頭辞は 1 つだけ: ${arg}` };
      opts.prefix = arg;
      continue;
    }
    const eq = arg.indexOf("=");
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    const value = eq === -1 ? null : arg.slice(eq + 1);
    if (!["help", "nearest", "view", "scope", "access", "state", "file"].includes(key)) return { ok: false, error: `知らないオプション: --${key}` };
    if (key === "help" || key === "nearest") {
      if (value !== null) return { ok: false, error: `--${key} は値を取らない` };
      opts[key] = true;
      continue;
    }
    if (value === null || value === "") return { ok: false, error: `--${key} は --${key}=<値> の形で書く` };
    if (key === "view") {
      if (!VIEWS.includes(value)) return { ok: false, error: `--view は ${VIEWS.join(" | ")}: ${value}` };
      opts.view = value;
    } else if (key === "scope") opts.scopes.push(normalizeScope(value));
    else if (key === "access") {
      if (!ACCESS_TOKEN.test(value)) return { ok: false, error: `--access の値が読めない: ${value}` };
      opts.access.push(value);
    } else if (key === "state") {
      if (!STATES.includes(value)) return { ok: false, error: `--state は ${STATES.join(" | ")}: ${value}` };
      opts.states.push(value);
    } else opts.file = value;
  }
  if (opts.nearest && opts.scopes.length === 0) return { ok: false, error: "--nearest は --scope と一緒に使う" };
  return { ok: true, opts };
}

/**
 * 地図ファイル(JSON Lines)を行の配列にする
 * @param {string} text
 * @returns {RouteMapRow[]}
 */
export function parseRouteMapJsonl(text) {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`地図の ${i + 1} 行目が JSON でない`);
      }
    });
}

/**
 * access の短い表示(tree / table / mermaid 用。--access の値と同じ言葉)。
 * public / authenticated はそのまま、{roles, roleCategories} は category:<c> / role:<r> を + でつなぐ、registry は registry:<domain>.<op>
 * @param {unknown} access
 * @returns {string}
 */
export function shortAccess(access) {
  if (typeof access === "string") return access;
  if (!access || typeof access !== "object") return JSON.stringify(access);
  if ("registry" in access) return `registry:${access.registry}`;
  const roleCategories = "roleCategories" in access && Array.isArray(access.roleCategories) ? access.roleCategories : [];
  const roles = "roles" in access && Array.isArray(access.roles) ? access.roles : [];
  const parts = [...roleCategories.map((c) => `category:${c}`), ...roles.map((r) => `role:${r}`)];
  return parts.length > 0 ? parts.join("+") : JSON.stringify(access);
}

/**
 * page.tsx のフォルダ(src/app からの相対。route group が見える)
 * @param {RouteMapRow} row
 */
const pageDirOf = (row) => {
  const page = row.chain.find((stage) => stage.kind === "page");
  return page ? rangeOf(page.file) : "?";
};

/**
 * @param {RouteMapRow} row
 * @returns {LoaderStage | undefined}
 */
const loaderOf = (row) => row.chain.find((stage) => stage.kind === "loader");
/**
 * @param {RouteMapRow} row
 * @returns {GuardStage[]} 最寄り → root の順
 */
const guardsOf = (row) => row.chain.filter((stage) => stage.kind === "guard");

/**
 * loader の access が --access の 1 つの値に当たるか
 * @param {LoaderStage | undefined} loader
 * @param {string} token --access の値 1 つ
 * @returns {boolean}
 */
export function matchesAccess(loader, token) {
  if (!loader) return false;
  const { access } = loader;
  if (token === "statuses") return loader.allowStatuses !== undefined;
  if (token === "public" || token === "authenticated") return access === token;
  if (!access || typeof access !== "object") return false;
  if (token === "registry") return "registry" in access;
  if (token.startsWith("registry:")) {
    const want = token.slice("registry:".length);
    return "registry" in access && typeof access.registry === "string" && (access.registry === want || access.registry.startsWith(`${want}.`));
  }
  if (token.startsWith("role:")) return "roles" in access && Array.isArray(access.roles) && access.roles.includes(token.slice(5));
  if (token.startsWith("category:")) return "roleCategories" in access && Array.isArray(access.roleCategories) && access.roleCategories.includes(token.slice(9));
  return false;
}

const matchesState = (/** @type {RouteMapRow} */ row, /** @type {string} */ state) =>
  state === "verified" ? row.state === "verified" : state === "gated-off" ? row.gatedOff != null : row.gatedOff == null;

/**
 * 絞り込み(別の種類どうしは AND、同じ種類の中は OR)
 * @param {RouteMapRow[]} rows
 * @param {ShowOptions} opts
 * @returns {RouteMapRow[]}
 */
export function filterRows(rows, opts) {
  const base = opts.prefix?.replace(/\/+$/, "");
  return rows.filter((row) => {
    if (base && !(row.path === base || row.path.startsWith(`${base}/`))) return false;
    if (opts.scopes.length > 0) {
      const ranges = guardsOf(row).map((g) => rangeOf(g.file));
      const candidates = opts.nearest ? ranges.slice(0, 1) : ranges;
      if (!opts.scopes.some((scope) => candidates.includes(scope))) return false;
    }
    if (opts.access.length > 0 && !opts.access.some((token) => matchesAccess(loaderOf(row), token))) return false;
    if (opts.states.length > 0 && !opts.states.some((state) => matchesState(row, state))) return false;
    return true;
  });
}

const EMPTY = "該当するページはありません\n";

/**
 * ページ 1 行の要約(tree の行末)
 * @param {RouteMapRow} row
 * @returns {string}
 */
function summary(row) {
  const loader = loaderOf(row);
  const nearest = guardsOf(row)[0];
  const parts = [`access=${loader ? shortAccess(loader.access) : "?"}`];
  if (loader?.allowStatuses !== undefined) parts.push("statuses");
  parts.push(`scope=${nearest ? rangeOf(nearest.file) : "?"}`);
  if (row.gatedOff) parts.push(`[gated-off(${row.gatedOff})]`);
  return parts.join("  ");
}

/**
 * tree: URL のセグメントの木。ページの行に access・最寄りの範囲・止めているか
 * @param {RouteMapRow[]} rows
 * @returns {string}
 */
export function renderTree(rows) {
  if (rows.length === 0) return EMPTY;
  /** @typedef {{ name: string, rows: RouteMapRow[], children: Map<string, TreeNode> }} TreeNode */
  /** @type {TreeNode} */
  const root = { name: "/", rows: [], children: new Map() };
  for (const row of rows) {
    let node = root;
    for (const segment of row.path.split("/").filter(Boolean)) {
      let child = node.children.get(segment);
      if (!child) {
        child = { name: segment, rows: [], children: new Map() };
        node.children.set(segment, child);
      }
      node = child;
    }
    node.rows.push(row);
  }
  /** @type {string[]} */
  const out = [];
  const labels = (/** @type {TreeNode} */ node) =>
    node.rows.length === 0 ? [node.name] : node.rows.map((row) => `${node.name}${row.slot ? ` ${row.slot}` : ""}  ${summary(row)}`);
  /**
   * @param {TreeNode} node
   * @param {string} prefix
   */
  const walk = (node, prefix) => {
    const children = [...node.children.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    children.forEach((child, i) => {
      const last = i === children.length - 1;
      const [first, ...rest] = labels(child);
      out.push(`${prefix}${last ? "└─ " : "├─ "}${first}`);
      const cont = `${prefix}${last ? "   " : "│  "}`;
      for (const line of rest) out.push(`${cont}${line}`);
      walk(child, cont);
    });
  };
  out.push(...labels(root));
  walk(root, "");
  return `${out.join("\n")}\n`;
}

const cell = (/** @type {unknown} */ value) => String(value).replace(/\|/g, "\\|");

/**
 * table: Markdown の表(1 ページ 1 行。page dir = page.tsx のフォルダで route group が見える)
 * @param {RouteMapRow[]} rows
 * @returns {string}
 */
export function renderTable(rows) {
  if (rows.length === 0) return EMPTY;
  const out = ["| path | slot | page dir | state | scope | access | guards (nearest → root) |", "|---|---|---|---|---|---|---|"];
  for (const row of rows) {
    const loader = loaderOf(row);
    const guards = guardsOf(row);
    const state = `${row.state}${row.gatedOff ? ` gated-off(${row.gatedOff})` : ""}`;
    const access = `${loader ? shortAccess(loader.access) : "?"}${loader?.allowStatuses !== undefined ? " +statuses" : ""}`;
    const chain = guards.map((g) => `${rangeOf(g.file)}: ${shortAccess(g.policy.access)}`).join(" > ");
    out.push(`| ${[row.path, row.slot ?? "", pageDirOf(row), state, guards[0] ? rangeOf(guards[0].file) : "?", access, chain].map(cell).join(" | ")} |`);
  }
  return `${out.join("\n")}\n`;
}

const mermaidText = (/** @type {string} */ text) => text.replace(/"/g, "#quot;");

/**
 * mermaid: guard.ts の範囲を入れ子の subgraph(extend の親子)、ページを最寄りの範囲の中の箱で描く
 * @param {RouteMapRow[]} rows
 * @returns {string}
 */
export function renderMermaid(rows) {
  if (rows.length === 0) return EMPTY;
  /** @typedef {{ name: string, access: unknown, parent: string | null, children: Set<string>, pages: RouteMapRow[] }} MermaidRange */
  /** @type {Map<string, MermaidRange>} 範囲の名前 → 範囲 */
  const ranges = new Map();
  for (const row of rows) {
    const guards = guardsOf(row);
    guards.forEach((guard, i) => {
      const name = rangeOf(guard.file);
      let range = ranges.get(name);
      if (!range) {
        range = { name, access: guard.policy.access, parent: null, children: new Set(), pages: [] };
        ranges.set(name, range);
      }
      const parent = guards[i + 1];
      if (parent) range.parent = rangeOf(parent.file);
    });
    if (guards[0]) ranges.get(rangeOf(guards[0].file))?.pages.push(row);
  }
  for (const range of ranges.values()) if (range.parent) ranges.get(range.parent)?.children.add(range.name);

  const out = ["flowchart LR", "  classDef gated stroke-dasharray: 5 5"];
  let guardId = 0;
  let pageId = 0;
  /**
   * @param {MermaidRange} range
   * @param {string} indent
   */
  const walk = (range, indent) => {
    out.push(`${indent}subgraph g${guardId++}["${mermaidText(`${range.name} · ${shortAccess(range.access)}`)}"]`);
    for (const row of range.pages) {
      const loader = loaderOf(row);
      const label = `${row.path}${row.slot ? ` ${row.slot}` : ""}<br/>${loader ? shortAccess(loader.access) : "?"}${row.gatedOff ? "<br/>gated-off" : ""}`;
      out.push(`${indent}  p${pageId++}["${mermaidText(label)}"]${row.gatedOff ? ":::gated" : ""}`);
    }
    for (const child of [...range.children].sort()) {
      const childRange = ranges.get(child);
      if (childRange) walk(childRange, `${indent}  `);
    }
    out.push(`${indent}end`);
  };
  const roots = [...ranges.values()].filter((r) => !r.parent || !ranges.has(r.parent)).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const root of roots) walk(root, "  ");
  return `${out.join("\n")}\n`;
}

/**
 * --view の形で描く
 * @param {RouteMapRow[]} rows
 * @param {string} view ShowOptions の view
 * @returns {string}
 */
export function renderRouteMap(rows, view) {
  if (view === "tree") return renderTree(rows);
  if (view === "table") return renderTable(rows);
  if (view === "mermaid") return renderMermaid(rows);
  if (view === "jsonl") return rows.length === 0 ? "" : formatRouteMap(rows);
  return formatRouteDetails(rows);
}

/**
 * @typedef {{ prefix: string | null, view: string, scopes: string[], nearest: boolean, access: string[], states: string[], file: string | null, help: boolean }} ShowOptions
 */
