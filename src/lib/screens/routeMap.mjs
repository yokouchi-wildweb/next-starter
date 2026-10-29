// ルート地図: 全ページの「URL → 方針の出どころ + 要約」を 1 ページ 1 行で並べた生成物(src/app/route-map.txt にコミット)。
// 生成: pnpm routes:map / ずれ検査: pnpm routes:map --check と pnpm test:route-map / 詳細の表示: pnpm routes:show
// ここは純粋関数だけ(ファイルの読み込みは呼び出し側が read を渡す)。発見は routeTree.mjs と共有。
// 設計と決定の経緯: src/lib/screens/README.md §13
import { createHash } from "node:crypto";

import { findBalancedEnd, parseSwitchLayout, stripComments } from "./checks.mjs";
import { patternCoversRoute } from "../../proxies/pathPattern.mjs";

import { APP_DIR, discoverRoutes } from "./routeTree.mjs";

/** 地図に書き出すファイル(repo 相対) */
export const ROUTE_MAP_FILE = "src/app/route-map.txt";

/**
 * 行の状態。loader Factory(F2)より前の方式で守られている行は全て legacy-unverified
 * (ガードの有無を問わず「機械が方針を検証していない」の意味。ガードが見つからない行も public とは書かない)
 */
export const ROUTE_STATE_LEGACY = "legacy-unverified";
// feature-gate の無効な規則で止めているルート(D18: 止めたページは地図に「止めている」と載る)。<pattern> = 当たった規則の最初のパターン
export const routeStateGatedOff = (pattern) => `gated-off(${pattern})`;

/** 方針の出どころとして拾うガード関数(layout・ルート内 loader の中の呼び出し) */
export const GUARD_FUNCTIONS = [
  "authGuard",
  "principalGuard",
  "deviceGuard",
  "requireCurrentUser",
  "getSessionUser",
  "requireAdmin",
  "requireAuthenticated",
];

/** ルート内 loader の置き場(ページの dir からの相対) */
const ROUTE_LOADERS = [
  { file: "_screen/loader.ts", label: "loader:_screen" },
  { file: "_components/loader.ts", label: "loader:_components" },
];

/** ガードではないが方針に関わる呼び出し(管理者数 0 → redirect 等)。地図には出さず routes:show だけに出す */
const NOTABLE_CALL_RE = /\b(redirect|notFound|[a-z]\w*Service\.\w+)\s*\(/g;

/**
 * 文字列リテラルの外の空白を消し、閉じ括弧の直前のカンマを落とす(書式の違いで hash が変わらないように)
 * @param {string} text
 */
export function normalizeArgs(text) {
  let out = "";
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1];
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (/\s/.test(ch)) continue;
    out += ch;
  }
  return out.replace(/,([)}\]])/g, "$1");
}

/** 引数の全文(正規化済み)の sha256 の先頭 8 桁。引数なしは 00000000 */
export function argsHash(normalized) {
  if (!normalized) return "00000000";
  return createHash("sha256").update(normalized).digest("hex").slice(0, 8);
}

/**
 * ソース中のガード関数の呼び出しを出現順に返す(コメントは除く。関数定義 `function authGuard(` は数えない)
 * @param {string} source
 * @returns {Array<{ name: string, args: string, hash: string }>}
 */
export function extractGuardCalls(source) {
  const src = stripComments(source);
  const re = new RegExp(`(\\bfunction\\s+)?\\b(${GUARD_FUNCTIONS.join("|")})\\s*\\(`, "g");
  const calls = [];
  for (const m of src.matchAll(re)) {
    if (m[1]) continue;
    const open = m.index + m[0].length - 1;
    const close = findBalancedEnd(src, open, "(", ")");
    const args = normalizeArgs(close < 0 ? src.slice(open + 1) : src.slice(open + 1, close));
    calls.push({ name: m[2], args, hash: argsHash(args) });
  }
  return calls;
}

/** ガード以外で方針に関わる呼び出し(redirect / notFound / *Service.xxx)。routes:show 用 */
export function extractNotableCalls(source) {
  const src = stripComments(source);
  return [...src.matchAll(NOTABLE_CALL_RE)].map((m) => m[1]);
}

/**
 * layout.tsx が `./_layout/<X>` への 1 行スイッチなら、スイッチ先のファイル(repo 相対)を返す。スイッチでない・見つからなければ null
 * @param {string} layoutFile layout.tsx の repo 相対パス
 * @param {string} source layout.tsx の内容
 * @param {Set<string>} fileSet
 */
export function resolveLayoutSwitchTarget(layoutFile, source, fileSet) {
  const { problems, target } = parseSwitchLayout(source);
  if (problems.length > 0 || !target) return null;
  const dir = layoutFile.slice(0, layoutFile.lastIndexOf("/"));
  const base = `${dir}/${target.screenDir}/${target.file}`;
  return [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`].find((candidate) => fileSet.has(candidate)) ?? null;
}

const appRelative = (dir) => (dir === APP_DIR ? "/" : dir.slice(APP_DIR.length + 1));

/**
 * 地図の元データを作る。
 * @param {{ files: string[], read: (path: string) => string, gateRules?: Array<{ pathPatterns: string[], enabled: boolean }> }} input
 *   files = repo 相対のファイル一覧(listAppFiles の結果)、read = repo 相対パスの中身を返す関数、
 *   gateRules = feature-gate の規則(src/config/app/feature-gate.config.ts)。無効な規則に当たるルートの state を gated-off にする
 * @returns {{ rows: Array<{ key: string, page: string, state: string, sources: Array<{ label: string, file: string, calls: ReturnType<typeof extractGuardCalls>, notable: string[] }> }>, problems: string[] }}
 *   sources は祖先の layout → ページ自身の layout → ルート内 loader の順(親子は AND)。ガードの無い layout も入る(地図の行では省く)
 */
export function buildRouteMap({ files, read, gateRules = [] }) {
  const disabledRules = gateRules.filter((rule) => !rule.enabled);
  const { routes, problems } = discoverRoutes(files);
  const fileSet = new Set(files.map((f) => f.replace(/\\/g, "/")));
  const rows = routes.map((route) => {
    const sources = route.layouts.map((file) => {
      const source = read(file);
      const calls = extractGuardCalls(source);
      const notable = extractNotableCalls(source);
      // 1 行スイッチの layout はスイッチ先の _layout/<X> の組み立てのガードも同じ出どころとして拾う(1 段だけ。README §13)
      const switchTarget = resolveLayoutSwitchTarget(file, source, fileSet);
      if (switchTarget) {
        const targetSource = read(switchTarget);
        calls.push(...extractGuardCalls(targetSource));
        notable.push(...extractNotableCalls(targetSource));
      }
      return {
        label: `layout:${appRelative(file.slice(0, file.lastIndexOf("/")))}`,
        file,
        calls,
        notable,
      };
    });
    for (const loader of ROUTE_LOADERS) {
      const file = `${route.dir}/${loader.file}`;
      if (!fileSet.has(file)) continue;
      const source = read(file);
      sources.push({ label: loader.label, file, calls: extractGuardCalls(source), notable: extractNotableCalls(source) });
    }
    const segments = route.key.split(" ")[0].split("/").filter(Boolean);
    const gated = disabledRules.find((rule) => rule.pathPatterns.some((pattern) => patternCoversRoute(pattern, segments)));
    const state = gated ? routeStateGatedOff(gated.pathPatterns[0]) : ROUTE_STATE_LEGACY;
    return { key: route.key, page: route.page, state, sources };
  });
  return { rows, problems };
}

/** 1 行の「方針の出どころ」欄。ガード呼び出しのある出どころだけを ` > ` でつなぐ。無ければ none */
export function formatSources(sources) {
  const parts = sources
    .filter((s) => s.calls.length > 0)
    .map((s) => `${s.label} ${s.calls.map((c) => `${c.name}#${c.hash}`).join("+")}`);
  return parts.length > 0 ? parts.join(" > ") : "none";
}

/** 地図ファイルの中身(ヘッダー + 1 ページ 1 行、key 順) */
export function formatRouteMap(rows) {
  const header = [
    "# route-map: generated by `pnpm routes:map`. DO NOT EDIT. merge conflict → rerun `pnpm routes:map`",
    "# <URL>[ @slot]\t<state>\t<policy sources: ancestor → leaf, AND>",
    `# state ${ROUTE_STATE_LEGACY} = guarded by the pre-Factory way, not verified by machine (none = no guard call found, NOT public)`,
    "# state gated-off(<pattern>) = stopped by a disabled feature-gate rule (src/config/app/feature-gate.config.ts): 404 at the proxy",
    "# details (layouts, guard arguments, loaders): pnpm routes:show [<URL prefix>]",
  ];
  const lines = rows.map((r) => `${r.key}\t${r.state}\t${formatSources(r.sources)}`);
  return `${[...header, ...lines].join("\n")}\n`;
}

/** routes:show の表示(コミットしない詳細) */
export function formatRouteDetails(rows) {
  const out = [];
  for (const r of rows) {
    out.push(`${r.key}  [${r.state}]  ${r.page}`);
    if (r.sources.length === 0) out.push("    (layout / loader なし)");
    for (const s of r.sources) {
      out.push(`    ${s.label}  ${s.file}`);
      for (const c of s.calls) out.push(`      guard ${c.name}#${c.hash}(${c.args})`);
      const notable = [...new Set(s.notable)];
      if (notable.length > 0) out.push(`      other ${notable.join(", ")}`);
    }
  }
  return `${out.join("\n")}\n`;
}
