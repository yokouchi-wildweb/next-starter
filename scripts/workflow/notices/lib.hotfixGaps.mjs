// scripts/workflow/notices/lib.hotfixGaps.mjs
// 緊急修正・先に取れる修正を載せた木で、その修正が前提にしている物がその木にあるかを見る部品(当てる側が使う)。
//   1. 修正が足した・変えたパス指定ルール(.claude/rules/**/*.md)の paths: の各 glob が、その木のファイルに当たるか
//   2. notice の required_actions / verify / manual_steps にある `pnpm <script>` が、その木の package.json にあるか
//      (入口の名指し pnpm workflow|ops <対象> <動作>・pnpm check|generate <対象>・pnpm test <パス> は、そのファイルがその木にあるか)
//   3. その notice が名指すリポのパス(`…` と refs:)が、その木にあるか
//   4. 当てた・足したコードのファイルの相対 import 先が、その木にあるか・名前で取る物をそこが export しているか(importGaps。
//      全部無い、または名の欠けがあれば先取りしても動かない)
// 使う所: hotfixApply.mjs(fork の木で当てた後に、止めずに報告)・pickCheck.mjs(壊れた地点の木。clean の条件の 1 つ)
import { parsePaths, unmatchedPaths } from "../rules/lib.rulePaths.mjs";

// pnpm の組み込みコマンド(package.json の scripts ではない)
const PNPM_BUILTIN = new Set(["install", "i", "add", "remove", "rm", "up", "update", "exec", "dlx", "run", "why", "list", "ls", "store", "env"]);
// 入口の名(pnpmEntries がファイルで見る): script 名としては数えない(`scripts workflow` / `scripts test` の重ねた行を出さない)
const PNPM_ENTRY = new Set(["workflow", "ops", "check", "generate", "test"]);
const PATH_ROOTS = /^(src|scripts|docs|servers|public|\.claude|\.notices|\.fork-ownership)\//;
const PATH_ROOTS_ANY = /^(src|scripts|servers|tests|eslint-rules|\.claude|\.notices)\//;

/** notice の欄のうち、fork が手順として実行するもの(required_actions から refs: の前まで)と refs: の値 */
export function noticeSections(text) {
  const lines = text.split("\n");
  const at = (k) => lines.findIndex((l) => l.startsWith(`${k}:`));
  const from = at("required_actions");
  const to = at("refs");
  const steps = from < 0 ? "" : lines.slice(from, to < 0 ? undefined : to).join("\n");
  const refs = to < 0 ? "" : lines[to].slice("refs:".length);
  return { steps, refs };
}

/** `pnpm <script>` の script 名(組み込みは除く。`pnpm run x` は x) */
export function pnpmScripts(text) {
  const out = new Set();
  for (const m of text.matchAll(/\bpnpm\s+(?:-s\s+|--silent\s+)?(run\s+)?([a-z][\w:.-]*)/g)) {
    if (!m[1] && PNPM_BUILTIN.has(m[2])) continue;
    if (PNPM_ENTRY.has(m[2])) continue;
    out.add(m[2]);
  }
  return [...out];
}

/** 入口の名指し(package.json の script ではなくファイルで決まる物): `pnpm workflow|ops <対象> <動作>` = scripts/<種類>/<対象>/<動作>.{mjs,js,ts}、
 *  `pnpm check|generate <対象>` = scripts/<分類>/<対象>/phase.json、`pnpm test <パス>` = そのパス(glob は除く)。[{ label, ok(files) }] */
export function pnpmEntries(text) {
  const out = new Map();
  const add = (label, ok) => out.has(label) || out.set(label, { label, ok });
  for (const m of text.matchAll(/\bpnpm\s+(?:-s\s+|--silent\s+)?(?:run\s+)?(workflow|ops)\s+([\w.-]+)\s+([\w.-]+)/g)) {
    const dir = `scripts/${m[1] === "ops" ? "operations" : "workflow"}/${m[2]}/`;
    add(`${m[1]} ${m[2]} ${m[3]}`, (files) => [".mjs", ".js", ".ts"].some((x) => files.includes(`${dir}${m[3]}${x}`)));
  }
  for (const m of text.matchAll(/\bpnpm\s+(?:-s\s+|--silent\s+)?(?:run\s+)?(check|generate)\s+([a-z][\w-]*)/g)) {
    add(`${m[1]} ${m[2]}`, (files) => files.some((f) => new RegExp(`^scripts/[^/]+/${m[2]}/gate\\.json$`).test(f)));
  }
  for (const m of text.matchAll(/\bpnpm\s+(?:-s\s+|--silent\s+)?(?:run\s+)?test((?:\s+(?:--[\w=,-]+|[\w./()-]+))+)/g)) {
    for (const t of m[1].trim().split(/\s+/).filter((x) => !x.startsWith("--") && PATH_ROOTS_ANY.test(x))) {
      add(`test ${t}`, (files) => files.some((f) => f === t || f.startsWith(t.replace(/\/$/, "") + "/")));
    }
  }
  return [...out.values()];
}

/** notice が名指すリポのパス: `…` の中と refs: の ` | ` 区切り。glob・<…>・空白を含むものは除く */
export function noticePaths(steps, refs) {
  const tokens = [...steps.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]);
  tokens.push(...refs.split("|").map((s) => s.trim().split(/\s+/)[0]));
  return [...new Set(tokens.map((t) => t.replace(/[.,:;)]+$/, "")).filter((t) => PATH_ROOTS.test(t) && !/[*?<>{}[\]]/.test(t)))];
}

const CODE_FILE = /\.(mjs|js|cjs|ts|tsx|mts|cts|jsx)$/;
const RESOLVE_EXT = ["", ".mjs", ".js", ".cjs", ".ts", ".tsx", ".mts", ".jsx", "/index.mjs", "/index.js", "/index.ts", "/index.tsx"];

/** コードの相対 import 先(import … from / export … from / import("…") / require("…") の ./ ../ で始まる物) */
export function relativeImports(text) {
  const out = new Set();
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])(\.{1,2}\/[^"']+)\1/gm;
  for (const m of text.matchAll(re)) out.add(m[2]);
  return [...out];
}

/** <file> の場所から <spec> を解いた候補のうち、木にある物(無ければ null) */
function resolveIn(files, file, spec) {
  const parts = file.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  const p = parts.join("/");
  for (const x of RESOLVE_EXT) if (files.has(p + x)) return p + x;
  // TypeScript の `./x.js` は x.ts を指す
  const stem = p.replace(/\.(m?js|cjs|jsx)$/, "");
  if (stem !== p) for (const x of [".ts", ".tsx", ".mts", ".cts"]) if (files.has(stem + x)) return stem + x;
  return null;
}

/** コードが相対 import 先から名前で取る物: spec → 名前の一覧(`import { a, b as c } from "./x"` の a・b、`export { a } from "./x"` の a)。
 *  型だけの import(`import type …`・`{ type A }`)は実行時に消えるので数えない。default・名前空間(`* as`)の import は数えない */
export function namedImports(text) {
  const out = new Map();
  const re = /\b(import|export)\s+(type\s+)?((?:[\w$]+\s*,\s*)?\{([^}]*)\})\s*from\s*(["'])(\.{1,2}\/[^"']+)\5/g;
  for (const m of text.matchAll(re)) {
    if (m[2]) continue;
    const names = m[4].split(",").map((x) => x.trim()).filter((x) => x && !/^type\s/.test(x)).map((x) => x.split(/\s+as\s+/)[0].trim()).filter((x) => x && x !== "default");
    if (!names.length) continue;
    out.set(m[6], [...new Set([...(out.get(m[6]) ?? []), ...names])]);
  }
  return out;
}

/** 本文が export する名前(`export const|let|var|function|function*|async function|class|enum <名>`・`export { a, b as c }` の a・c・
 *  `export default` = default)。`export * from` があれば名を決められないので null(照らさない) */
export function exportedNames(text) {
  if (/\bexport\s+\*\s+from\b/.test(text)) return null;
  const out = new Set();
  for (const m of text.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|enum|abstract\s+class)\s+([\w$]+)/g)) out.add(m[1]);
  for (const m of text.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const x of m[1].split(",").map((y) => y.trim()).filter(Boolean)) out.add(x.replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim());
  }
  for (const m of text.matchAll(/\bexport\s+\*\s+as\s+([\w$]+)\s+from\b/g)) out.add(m[1]);
  if (/\bexport\s+default\b/.test(text)) out.add("default");
  return out;
}

/**
 * 当てた・足したコードの相対 import 先で、その木に無い物と、有っても名前で取る物を export していない物(ESM はその名が無いと
 * 読み込めない: Aurora線 11-21、先取りした compactPlan.mjs の `{ handoffFile }` を fork の lib.mjs が持たず /coffee-break が止まった)。
 * @param {{ files: string[], changed: string[], read: (f: string) => string | null }} input  changed = 当てた・足したファイル
 * @returns {{ file: string, target?: string, all?: boolean, targets?: string[] }[]}  全部の import 先が無いファイル、または名の欠けが
 *   あるファイル(読み込めない = 動かない)は { file, all, targets } 1 つ(名の欠けは `./x (a, b が無い)`)
 */
export function importGaps({ files, changed, read }) {
  const have = new Set(files);
  const out = [];
  for (const file of changed) {
    if (!CODE_FILE.test(file)) continue;
    const text = read(file);
    if (!text) continue;
    const specs = relativeImports(text);
    const missing = specs.filter((s) => !resolveIn(have, file, s));
    const named = namedImports(text);
    const lacking = [];
    for (const [spec, names] of named) {
      const at = resolveIn(have, file, spec);
      if (!at) continue;
      const body = read(at);
      const exp = body == null ? null : exportedNames(body);
      if (!exp) continue;   // 読めない・`export *` = 名を決められない: 出さない
      const no = names.filter((n) => !exp.has(n));
      if (no.length) lacking.push(`${spec} (${no.join(", ")} が無い)`);
    }
    if (!missing.length && !lacking.length) continue;
    if (lacking.length || missing.length === specs.length) out.push({ file, all: true, targets: [...missing, ...lacking] });
    else for (const s of missing) out.push({ file, target: s });
  }
  return out;
}

/** 1 つの木で見つかった依存: { rules: [{file, globs}], scripts: [], paths: [] } */
export function findGaps({ files, packageJson, rules, notice }) {
  const gaps = { rules: [], scripts: [], paths: [] };
  for (const { file, text } of rules) {
    const globs = parsePaths(text);
    if (!globs) continue;
    const miss = unmatchedPaths(globs, files);
    if (miss.length) gaps.rules.push({ file, globs: miss });
  }
  if (notice) {
    const { steps, refs } = noticeSections(notice);
    const scripts = packageJson?.scripts ?? {};
    gaps.scripts = [...pnpmScripts(steps).filter((s) => !(s in scripts)), ...pnpmEntries(steps).filter((e) => !e.ok(files)).map((e) => e.label)];
    gaps.paths = noticePaths(steps, refs).filter((p) => !files.some((f) => f === p || f.startsWith(p.replace(/\/$/, "") + "/")));
  }
  return gaps;
}

export function hasGaps(g) {
  return g.rules.length + g.scripts.length + g.paths.length > 0;
}

