// scripts/workflow/notices/lib.hotfixGaps.mjs
// 緊急修正・先に取れる修正を載せた木で、その修正が前提にしている物がその木にあるかを見る部品(当てる側が使う)。
//   1. 修正が足した・変えたパス指定ルール(.claude/rules/**/*.md)の paths: の各 glob が、その木のファイルに当たるか
//   2. notice の required_actions / verify / manual_steps にある `pnpm <script>` が、その木の package.json にあるか
//      (入口の名指し pnpm workflow|ops <対象> <動作>・pnpm check|generate <対象>・pnpm test <パス> は、そのファイルがその木にあるか)
//   3. その notice が名指すリポのパス(`…` と refs:)が、その木にあるか
// 使う所: hotfixApply.mjs(fork の木で当てた後に、止めずに報告)・pickCheck.mjs(壊れた地点の木。clean の条件の 1 つ)
import { parsePaths, unmatchedPaths } from "../rules/lib.rulePaths.mjs";

// pnpm の組み込みコマンド(package.json の scripts ではない)
const PNPM_BUILTIN = new Set(["install", "i", "add", "remove", "rm", "up", "update", "exec", "dlx", "run", "why", "list", "ls", "store", "env"]);
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
    out.add(m[2]);
  }
  return [...out];
}

/** 入口の名指し(package.json の script ではなくファイルで決まる物): `pnpm workflow|ops <対象> <動作>` = scripts/<種類>/<対象>/<動作>.{mjs,js,ts}、
 *  `pnpm check|generate <対象>` = scripts/<分類>/<対象>/gate.json、`pnpm test <パス>` = そのパス(glob は除く)。[{ label, ok(files) }] */
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

