// scripts/structure/lib-package/standalone.mjs
//
// 宣言した lib(package.json を持つ lib)の単体用 tsconfig.json を確かめ、その tsconfig で型検査する。
// - tsconfig.json は lib の中に手で書く(道具は lib の中に書かない)。形 = expectedTsconfig(下)、説明 = README.md
// - paths は package.json の libs・peers を辿った閉包 + @lib-config/<自分>(設定 config.ts を持つ lib だけ。無い lib に無いファイルへの行を書かない)。ルートの "@/*" は引き継がない
//   (extends は paths を丸ごと置き換える)ので、宣言していない lib・棚を読むと解決できずに落ちる
// - 相対パスで lib の外へ出る import は paths では止まらないので、自分のファイルの import を解いて別に見る
// - JS(.mjs / .js)のファイルを持つ lib は allowJs + checkJs で JS も型検査する(include に **/*.mjs・**/*.js を足す)。
//   node で走る .mjs が .ts を拡張子つきで読めるよう allowImportingTsExtensions も足す。飛ばさないのは、tsx を通さない Node の道具から読む .mjs の lib でも宣言の外を読めば止めるため。TS だけの lib の形は変わらない
// - 数えるのは自分のファイルの診断だけ。依存の lib・棚・設定のファイルの診断は数えない(依存はその lib の検査が見る)

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { LIB_DIR, PEER_DIRS, readLibPackage } from "../../../src/lib/libPackage/index.mjs";

/** lib の設定(指令 24 の @lib-config/<自分>)の置き場(repo 相対)。<self> = lib の名前 */
export const LIB_CONFIG_PATH = "src/config/lib/<self>.config.ts";
/** 単体用 tsconfig の include(lib の中の全部の ts / tsx。テストも含む) */
export const STANDALONE_INCLUDE = Object.freeze(["**/*.ts", "**/*.tsx"]);
/** JS のファイルを持つ lib の単体用 tsconfig の include に足す物 */
export const STANDALONE_JS_INCLUDE = Object.freeze(["**/*.mjs", "**/*.js"]);
/** JS のファイルを持つ lib の単体用 tsconfig の compilerOptions に足す物(JS も型検査する。node で走る .mjs は .ts を拡張子つきで読むので allowImportingTsExtensions。ルートの noEmit の下で有効) */
export const STANDALONE_JS_OPTIONS = Object.freeze({ allowJs: true, allowImportingTsExtensions: true, checkJs: true });
/** lib の中から見たルートの tsconfig.json */
export const STANDALONE_EXTENDS = "../../../tsconfig.json";

const toPosix = (p) => p.split(path.sep).join("/");
const configPathOf = (lib) => LIB_CONFIG_PATH.replace("<self>", lib);

/** lib が設定(config.ts / config.tsx)を持つか。持つ lib だけが @lib-config/<自分> を読む(src/lib/README.md「設定の届け方」) */
export function hasLibConfig(root, lib) {
  const dir = path.join(root, LIB_DIR, lib);
  return ["config.ts", "config.tsx"].some((f) => existsSync(path.join(dir, f)));
}

/**
 * 宣言の閉包: 自分の libs を辿り、辿った先の package.json の libs・peers も足す(package.json の無い lib は先へ辿らない)
 * @returns {{ libs: string[], peers: string[] }}
 */
export function closureOf(root, lib) {
  const libs = new Set();
  const peers = new Set();
  const queue = [lib];
  const seen = new Set([lib]);
  while (queue.length > 0) {
    const pkg = readLibPackage(root, queue.shift());
    if (!pkg) continue;
    for (const peer of pkg.peers) peers.add(peer);
    for (const dep of pkg.libs) {
      if (dep !== lib) libs.add(dep);
      if (!seen.has(dep)) {
        seen.add(dep);
        queue.push(dep);
      }
    }
  }
  return { libs: [...libs].sort(), peers: [...peers].sort() };
}

/** その lib の tsconfig.json に書く paths(鍵 → 値の配列 1 つ)。鍵の名前順 */
export function expectedPaths(root, lib) {
  const { libs, peers } = closureOf(root, lib);
  const paths = {};
  for (const dep of libs) {
    paths[`@/lib/${dep}`] = [`../${dep}`];
    paths[`@/lib/${dep}/*`] = [`../${dep}/*`];
  }
  for (const peer of peers) {
    const peerDir = PEER_DIRS[peer];
    paths[`@/${peer}/*`] = [`${toPosix(path.relative(`${LIB_DIR}/${lib}`, peerDir))}/*`];
  }
  if (hasLibConfig(root, lib)) paths[`@lib-config/${lib}`] = [toPosix(path.relative(`${LIB_DIR}/${lib}`, configPathOf(lib)))];
  return Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
}

const JS_FILE_RE = /\.(mjs|js)$/;

/** lib の中に JS のファイル(.mjs / .js。テストも含む)があるか */
export function hasJsFiles(root, lib) {
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    return entries.some((e) => (e.isDirectory() ? e.name !== "node_modules" && walk(path.join(dir, e.name)) : JS_FILE_RE.test(e.name)));
  };
  return walk(path.join(root, LIB_DIR, lib));
}

/** その lib が持つべき tsconfig.json の中身(JS のファイルを持つ lib は allowJs・checkJs と JS の include を足す) */
export function expectedTsconfig(root, lib) {
  const paths = expectedPaths(root, lib);
  const js = hasJsFiles(root, lib);
  // 行の無い paths・空の compilerOptions は書かない(依存も設定も無い lib)
  const compilerOptions = { ...(js ? STANDALONE_JS_OPTIONS : {}), ...(Object.keys(paths).length > 0 ? { paths } : {}) };
  return {
    extends: STANDALONE_EXTENDS,
    ...(Object.keys(compilerOptions).length > 0 ? { compilerOptions } : {}),
    include: js ? [...STANDALONE_INCLUDE, ...STANDALONE_JS_INCLUDE] : [...STANDALONE_INCLUDE],
  };
}

const json = (value) => JSON.stringify(value);

/**
 * lib の tsconfig.json を package.json の宣言と比べる。問題の一覧(無ければ空)
 * @returns {{ lib: string, code: string, message: string }[]}
 */
export function compareTsconfig(root, lib) {
  const file = `${LIB_DIR}/${lib}/tsconfig.json`;
  const expected = expectedTsconfig(root, lib);
  const problem = (code, message) => ({ lib, code, message: `${file}: ${message}` });
  if (!existsSync(path.join(root, file))) {
    return [problem("tsconfigMissing", `ありません。次の中身で置きます:\n${JSON.stringify(expected, null, 2)}`)];
  }
  const read = ts.readConfigFile(path.join(root, file), ts.sys.readFile);
  if (read.error) return [problem("tsconfigJson", `読めません: ${ts.flattenDiagnosticMessageText(read.error.messageText, "\n")}`)];
  const actual = read.config ?? {};
  const out = [];
  for (const key of Object.keys(actual)) {
    // compilerOptions は中身を下で見る(期待に無い = 中の行を全部消す)
    if (key !== "compilerOptions" && !Object.hasOwn(expected, key)) out.push(problem("tsconfigKey", `"${key}" は書きません(書くのは extends / compilerOptions.paths / include だけ)`));
  }
  if (actual.extends !== expected.extends) out.push(problem("tsconfigExtends", `"extends" は ${json(expected.extends)} にします`));
  if (json(actual.include) !== json(expected.include)) out.push(problem("tsconfigInclude", `"include" は ${json(expected.include)} にします`));
  const options = actual.compilerOptions ?? {};
  const expectedOptions = expected.compilerOptions ?? {};
  for (const key of Object.keys(options)) {
    // paths の行は下の pathsExtra が名指しする
    if (key !== "paths" && !Object.hasOwn(expectedOptions, key)) out.push(problem("tsconfigOption", `compilerOptions の "${key}" は書きません(ルートの tsconfig.json から引き継ぎます)`));
  }
  for (const [key, value] of Object.entries(expectedOptions)) {
    if (key === "paths") continue;
    if (options[key] !== value) out.push(problem("tsconfigOption", `compilerOptions の "${key}" は ${json(value)} にします(lib に JS のファイルがあるので JS も型検査します)`));
  }
  const actualPaths = options.paths ?? {};
  const expectedPathMap = expectedOptions.paths ?? {};
  for (const [key, value] of Object.entries(expectedPathMap)) {
    if (!Object.hasOwn(actualPaths, key)) out.push(problem("pathsMissing", `paths に ${json(key)}: ${json(value)} を足します`));
    else if (json(actualPaths[key]) !== json(value)) out.push(problem("pathsValue", `paths の ${json(key)} は ${json(value)} にします`));
  }
  for (const key of Object.keys(actualPaths)) {
    if (!Object.hasOwn(expectedPathMap, key)) {
      const why = key.startsWith("@lib-config/") ? "lib に設定 config.ts が無い" : "package.json の libs・peers に無い";
      out.push(problem("pathsExtra", `paths の ${json(key)} を消します(${why})`));
    }
  }
  return out;
}

/** 自分の lib から読んでよいファイルの根(絶対パス): 自分・閉包の lib・棚・設定のファイル */
function allowedRoots(root, lib) {
  const { libs, peers } = closureOf(root, lib);
  const dirs = [lib, ...libs].map((name) => path.join(root, LIB_DIR, name) + path.sep);
  for (const peer of peers) dirs.push(path.join(root, PEER_DIRS[peer]) + path.sep);
  return { dirs, config: path.join(root, configPathOf(lib)) };
}

const isOwn = (file, ownDir) => path.resolve(file).startsWith(ownDir);

/**
 * lib の tsconfig.json で型検査する(出力しない)。問題の一覧(無ければ空)
 * - diagnostic: 自分のファイル(とファイルの無い全体)の診断
 * - escape: 自分のファイルの import が、読んでよい根の外(node_modules を除く)に解けた
 */
export function typecheckLib(root, lib) {
  const configFile = path.join(root, LIB_DIR, lib, "tsconfig.json");
  const ownDir = path.join(root, LIB_DIR, lib) + path.sep;
  const rel = (file) => toPosix(path.relative(root, file));
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  if (read.error) return [{ lib, code: "tsconfigJson", message: ts.flattenDiagnosticMessageText(read.error.messageText, "\n") }];
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configFile), { noEmit: true, incremental: false }, configFile);
  const out = [];
  const format = (d) => {
    const text = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file) return text;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    return `${rel(d.file.fileName)}:${line + 1}:${character + 1} TS${d.code} ${text}`;
  };
  for (const d of parsed.errors) out.push({ lib, code: "diagnostic", message: format(d) });
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, projectReferences: parsed.projectReferences });
  for (const d of [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics(), ...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()]) {
    if (d.file && !isOwn(d.file.fileName, ownDir)) continue;
    out.push({ lib, code: "diagnostic", message: format(d) });
  }
  const allowed = allowedRoots(root, lib);
  const host = ts.createCompilerHost(parsed.options);
  for (const file of parsed.fileNames.filter((f) => isOwn(f, ownDir))) {
    const { importedFiles } = ts.preProcessFile(ts.sys.readFile(file) ?? "", true, true);
    for (const { fileName: spec } of importedFiles) {
      const resolved = ts.resolveModuleName(spec, file, parsed.options, host).resolvedModule;
      if (!resolved || resolved.isExternalLibraryImport) continue;
      const target = path.resolve(resolved.resolvedFileName);
      if (target.split(path.sep).includes("node_modules")) continue;
      if (allowed.dirs.some((dir) => target.startsWith(dir)) || target === allowed.config) continue;
      out.push({ lib, code: "escape", message: `${rel(file)}: "${spec}" が宣言の外 ${rel(target)} を読みます(package.json の libs・peers に足すか、読むのをやめます)` });
    }
  }
  return out;
}
