// scripts/structure/lib-package/closed.mjs
//
// 閉じたかの検査(指令 26 d1): lib ごとの状態。
// - 落とす(宣言した lib = package.json を持ち形に問題が無い lib だけ): 単体用 tsconfig・型検査・sideEffects(standalone.mjs / sideEffects.mjs)、
//   config.ts があるのに上書き src/config/lib/<名前>.config.ts が無い、自前の合成(defineXxxConfig)が残っている(L1.23)
// - 数えて見せるだけ(--list / --json): 外から lib の中を読む import。宣言した lib のそれは pnpm lint の lib-entry が落とす(1 つの規則)
// - 宣言の無い lib は数えて一覧に出すだけで落とさない(L1.21。error にするのは最後の段 D101 (6))

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { LIB_DIR, findEntry, libOfPath, listLibs, readLibPackage } from "../../../src/lib/libPackage/index.mjs";
import { checkSideEffects } from "./sideEffects.mjs";
import { LIB_CONFIG_PATH, compareTsconfig, typecheckLib } from "./standalone.mjs";

/** 設定の合成器そのものの lib(契約 api.defineconfig が名指す lib)。自前の合成の判定は掛けない */
export const COMPOSER_LIB = "defineConfig";
/** 自前の合成の形: define<名前>Config を export する、または合成器と同じ名前のファイル defineConfig.<ext> で define<名前> を export する */
const MERGE_HELPER_NAME = /^define[A-Z]\w*Config$/;
const DEFINE_NAME = /^define[A-Z]\w*$/;
const COMPOSER_FILE = /(^|\/)defineConfig\.(ts|tsx|mts|mjs|js)$/;

const SOURCE_RE = /\.(ts|tsx|mts|mjs|js|jsx|cjs)$/;
const TEST_RE = /(\.test\.|\.spec\.|\.d\.ts$|(^|\/)__tests__\/)/;
/** lint が見ない所(eslint.config.mjs の ignores に合わせる) */
const SCAN_SKIP = [/(^|\/)node_modules\//, /^\.next\//, /^\.firebase\//, /^src\/_stash\//, /^\.claude\/worktrees\//];

const toPosix = (p) => p.split(path.sep).join("/");

function walk(root, dir = "") {
  const out = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    if (entry.isDirectory()) out.push(...walk(root, rel));
    else out.push(rel);
  }
  return out;
}

/** 走査するソース(repo 相対)。git があれば追跡 + 未追跡(ignore を除く)、無ければ全部を歩く(fixture) */
export function scanFiles(root) {
  let files;
  if (existsSync(path.join(root, ".git"))) {
    files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
  } else files = walk(root);
  return files.filter((f) => SOURCE_RE.test(f) && !SCAN_SKIP.some((re) => re.test(f)) && existsSync(path.join(root, f)));
}

/** 解いた先が lib の根(フォルダそのもの か 直下の index)か */
const isLibRoot = (resolved, lib) => {
  const base = `${LIB_DIR}/${lib}`;
  return resolved === base || resolved.replace(SOURCE_RE, "") === `${base}/index`;
};

/**
 * 外から lib の中を読む import を数える(repo を 1 回走査)。lint の lib-entry と同じ部品(resolveImport・libOfPath・findEntry)で判定する
 * - 宣言した lib: exports の入口に当たらない import
 * - 宣言の無い lib: lib の根(index)以外に当たる import(参考の数)
 * @returns {Map<string, { count: number, samples: string[] }>}
 */
export function scanInnerImports(root, { sampleLimit = 5 } = {}) {
  const hits = new Map();
  for (const file of scanFiles(root)) {
    const importer = libOfPath(file);
    const text = readFileSync(path.join(root, file), "utf8");
    const { importedFiles } = ts.preProcessFile(text, true, true);
    for (const { fileName: spec } of importedFiles) {
      if (spec.startsWith("@lib-config/")) continue;
      const resolved = resolveImport(spec, path.join(root, file), root);
      const lib = resolved ? libOfPath(resolved) : null;
      if (!lib || lib === importer) continue;
      const pkg = readLibPackage(root, lib);
      const inner = pkg && pkg.problems.length === 0 ? !findEntry(pkg, resolved) : !isLibRoot(resolved, lib);
      if (!inner) continue;
      const row = hits.get(lib) ?? { count: 0, samples: [] };
      row.count += 1;
      if (row.samples.length < sampleLimit) row.samples.push(`${file} → ${spec}`);
      hits.set(lib, row);
    }
  }
  return hits;
}

function libSources(root, lib) {
  const dir = path.join(root, LIB_DIR, lib);
  return walk(root, toPosix(path.relative(root, dir))).filter((f) => SOURCE_RE.test(f) && !TEST_RE.test(f));
}

/**
 * 自前の合成: @/lib/defineConfig を読まず、define<名前>Config を export する(defineFontsConfig・defineSiteThemeConfig)か、
 * defineConfig.<ext> というファイルで define<名前> を export する(defineVariantOverrides)lib。名前の一覧(無ければ空)
 * crud の defineHiddenColumns のような設定の合成でない define は当たらない
 */
export function mergeHelpersOf(root, lib) {
  if (lib === COMPOSER_LIB) return [];
  const names = [];
  let usesComposer = false;
  for (const file of libSources(root, lib)) {
    const text = readFileSync(path.join(root, file), "utf8");
    const { importedFiles } = ts.preProcessFile(text, true, true);
    if (importedFiles.some(({ fileName }) => libOfPath(resolveImport(fileName, path.join(root, file), root) ?? "") === COMPOSER_LIB)) usesComposer = true;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false);
    const isHelper = (name) => MERGE_HELPER_NAME.test(name) || (COMPOSER_FILE.test(file) && DEFINE_NAME.test(name));
    for (const statement of source.statements) {
      const exported = ts.getModifiers?.(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      if (ts.isFunctionDeclaration(statement) && statement.name && isHelper(statement.name.text)) names.push(statement.name.text);
      if (ts.isVariableStatement(statement)) {
        for (const d of statement.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && isHelper(d.name.text)) names.push(d.name.text);
        }
      }
    }
  }
  return usesComposer ? [] : [...new Set(names)].sort();
}

/** 設定: config.ts が無ければ "none"、あって上書きがあれば "ok"、上書きが無ければ "overrideMissing" */
export function configStateOf(root, lib) {
  const dir = path.join(root, LIB_DIR, lib);
  if (!["config.ts", "config.tsx"].some((f) => existsSync(path.join(dir, f)))) return "none";
  return existsSync(path.join(root, LIB_CONFIG_PATH.replace("<self>", lib))) ? "ok" : "overrideMissing";
}

/**
 * 宣言した lib の落とす不備(形に問題のある lib は呼ばない)
 * @returns {{ lib: string, code: string, message: string }[]}
 */
export function closedLibProblems(root, lib) {
  const out = [];
  const diverged = compareTsconfig(root, lib);
  out.push(...diverged);
  if (diverged.length === 0) out.push(...typecheckLib(root, lib));
  out.push(...checkSideEffects(root, lib));
  if (configStateOf(root, lib) === "overrideMissing") {
    out.push({ lib, code: "overrideMissing", message: `${LIB_DIR}/${lib}/config.ts があるのに上書き ${LIB_CONFIG_PATH.replace("<self>", lib)} がありません(空の上書きを置きます。src/lib/README.md「設定の届け方」)` });
  }
  for (const name of mergeHelpersOf(root, lib)) {
    out.push({ lib, code: "mergeHelper", message: `${LIB_DIR}/${lib}: 自前の合成 ${name} が残っています(@/lib/defineConfig の defineConfig に寄せます。L1.23)` });
  }
  return out;
}

/**
 * lib ごとの状態の行(全部の lib)。withInner = 外から中を読む import も数える(repo を走査する。--list / --json)
 * state: closed(宣言・不備 0)| gaps(宣言・不備あり)| skipped(package.json の形に問題)| undeclared
 */
export function libStates(root, { withInner = false } = {}) {
  const inner = withInner ? scanInnerImports(root) : null;
  return listLibs(root).map((lib) => {
    const pkg = readLibPackage(root, lib);
    const row = {
      lib,
      state: "undeclared",
      declared: pkg ? (pkg.problems.length === 0 ? "ok" : `problems:${pkg.problems.length}`) : "none",
      innerImports: inner ? (inner.get(lib)?.count ?? 0) : null,
      innerSamples: inner ? (inner.get(lib)?.samples ?? []) : [],
      config: configStateOf(root, lib),
      mergeHelpers: mergeHelpersOf(root, lib),
      problems: [],
    };
    if (!pkg) return row;
    if (pkg.problems.length > 0) return { ...row, state: "skipped" };
    row.problems = closedLibProblems(root, lib);
    row.state = row.problems.length === 0 ? "closed" : "gaps";
    return row;
  });
}
