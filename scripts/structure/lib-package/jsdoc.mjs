// scripts/structure/lib-package/jsdoc.mjs
//
// 動き jsdoc: 閉じた lib の JS(.mjs / .js)の暗黙の any に、使われ方から推した型を JSDoc で書く(TypeScript の codefix inferFromUsage)。
// 実行: pnpm check lib-package -- jsdoc [--lib <名前>]... [--apply] [--json](振り分けは check.mjs)。既定は dry-run(書かない)。
// - 対象: package.json と単体用 tsconfig.json を持ち、JS のファイルを持つ lib(--lib で絞る)。tsconfig が期待と食い違う lib は飛ばして名前を出す
// - lib の単体用 tsconfig で言語サービスを立て、lib の中の JS ファイルの暗黙の any の診断(IMPLICIT_ANY_CODES)に codefix を当てる。
//   1 つ書くと次の推しが変わるので、変わらなくなるまで(最大 ROUNDS 回)繰り返す。書くのは lib の中のファイルだけ
// - 推せずに any と書いた所(欄の any・複数行の型の行も)は一覧に出す(人が本当の型に直す)。暗黙の any 以外の型の誤りは直さない(pnpm check lib-package が名指しする)
// - 空の配列から推した never[] を含む直しは書かずに一覧に出す(never[] は何も入らない配列 = 本当の型でない。人が書く)
// - 書式(FORMAT)を codefix に渡す: 渡さないと複数行の JSDoc の字下げが落ちる
// - 緩めない: 単体用 tsconfig の形は変えない(閉じた .mjs の lib は JSDoc で strict の型検査を通す。README「lib の tsconfig.json」)
// - 祖先の lib(目録 src/lib/CATALOG.md の自分以外の節の lib)の中は書かない(core/lib.md: never edit internals): --lib なしは自分の lib だけ、
//   --lib で祖先の lib を名指せば何もせず exit 2。Tier1 は目録の先頭の節 = 自分なので全部
// - exit 0(書いた・書く物が無い)/ 2 = 引数の誤り・知らない lib・祖先の lib

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { LIB_DIR } from "../../../src/lib/libPackage/index.mjs";
import { loadCatalogOwnership } from "../../../src/lib/folderCatalog/node.mjs";
import { listDeclaredLibs, readLibPackage } from "../../../src/lib/libPackage/node.mjs";
import { compareTsconfig, hasJsFiles } from "./standalone.mjs";

/** 暗黙の any の診断(引数・変数・分割代入・戻り値・メンバー・this・rest など) */
export const IMPLICIT_ANY_CODES = new Set([7005, 7006, 7008, 7010, 7011, 7019, 7022, 7023, 7024, 7031, 7034, 7043, 7044, 7045, 7046, 7047, 7048, 7049, 7050]);
/** codefix の id(JS では JSDoc の @param / @type / @returns を書く) */
const FIX_ID = "inferFromUsage";
const ROUNDS = 4;
/** 書く JSDoc の書式(渡さないと複数行の JSDoc の字下げが落ちる)。この repo の字下げ = 空白 2 */
const FORMAT = { ...ts.getDefaultFormatCodeSettings("\n"), indentSize: 2, tabSize: 2, convertTabsToSpaces: true };
const JS_FILE_RE = /\.(mjs|js)$/;
/** 推せずに書いた any(JSDoc の型の中の語。欄の any も) */
const ANY_RE = /(?<![\w$."'])any(?![\w$"'])/;
/** 空の配列から推した型(書かない) */
const NEVER_ARRAY_RE = /\bnever\[\]/;
/** JSDoc の行(書いた型の行): `/** … *\/` を含むか、`*` で始まる続きの行 */
const isJsdocLine = (/** @type {string} */ line) => line.includes("/**") || /^\s*\*/.test(line);
/** 複数行の JSDoc を 1 行に(続きの行の先頭の * を落とす) */
const oneLine = (/** @type {string} */ jsdoc) =>
  jsdoc
    .split("\n")
    .map((line) => line.trim().replace(/^\*(?!\/)\s?/, ""))
    .filter(Boolean)
    .join(" ");

/** @typedef {{ file: string, line: number, kind: "any" | "never[]", text: string }} JsdocAny 人が本当の型に直す所 */

const USAGE = "pnpm check lib-package -- jsdoc [--lib <名前>]... [--apply] [--json]";
const toPosix = (p) => p.split(path.sep).join("/");

/**
 * lib の単体用 tsconfig で言語サービスを立てる(書いた中身は texts に持ち、ディスクには書かない)
 * @param {string} root
 * @param {string} lib
 */
function libService(root, lib) {
  const configFile = path.join(root, LIB_DIR, lib, "tsconfig.json");
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configFile), { noEmit: true, incremental: false }, configFile);
  /** @type {Map<string, string>} */
  const texts = new Map();
  /** @type {Map<string, number>} */
  const versions = new Map();
  const readText = (/** @type {string} */ f) => texts.get(f) ?? ts.sys.readFile(f);
  /** @type {ts.LanguageServiceHost} */
  const host = {
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: (f) => String(versions.get(f) ?? 0),
    getScriptSnapshot: (f) => {
      const text = readText(f);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: (f) => texts.has(f) || ts.sys.fileExists(f),
    readFile: readText,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  const ownDir = path.join(root, LIB_DIR, lib) + path.sep;
  const files = parsed.fileNames.filter((f) => path.resolve(f).startsWith(ownDir) && JS_FILE_RE.test(f));
  /** @param {string} file @param {string} text */
  const setText = (file, text) => {
    texts.set(file, text);
    versions.set(file, (versions.get(file) ?? 0) + 1);
  };
  return { service, files, texts, setText, readText };
}

/**
 * 1 つの lib の書く物を求める(書かない)
 * @param {string} root
 * @param {string} lib
 * @returns {{ lib: string, before: number, after: number, files: { file: string, edits: number, text: string }[], anys: JsdocAny[] }}
 *   anys = 人が本当の型に直す所(kind any = 書いた / never[] = 書かなかった直しで、line・text はその直しを当てる行)
 */
export function planLib(root, lib) {
  const { service, files, texts, setText, readText } = libService(root, lib);
  const implicitAny = (/** @type {string} */ f) => service.getSemanticDiagnostics(f).filter((d) => IMPLICIT_ANY_CODES.has(d.code));
  const count = () => files.reduce((n, f) => n + implicitAny(f).length, 0);
  const before = count();
  /** @type {Map<string, number>} */
  const edits = new Map();
  /** 書かなかった never[] の直し: ファイル → 当てる行の中身 → 書こうとした JSDoc(回をまたいで同じ物は 1 つ) */
  /** @type {Map<string, Map<string, string>>} */
  const skipped = new Map();
  for (let round = 0; round < ROUNDS; round++) {
    let changed = 0;
    for (const file of files) {
      if (implicitAny(file).length === 0) continue;
      const fix = service.getCombinedCodeFix({ type: "file", fileName: file }, FIX_ID, FORMAT, {});
      for (const change of fix.changes) {
        // lib の外(依存の lib・棚)には書かない
        if (!files.includes(change.fileName) || change.textChanges.length === 0) continue;
        let text = readText(change.fileName) ?? "";
        const writable = [];
        for (const tc of change.textChanges) {
          if (!NEVER_ARRAY_RE.test(tc.newText)) {
            writable.push(tc);
            continue;
          }
          const lineStart = text.lastIndexOf("\n", tc.span.start - 1) + 1;
          const lineEnd = text.indexOf("\n", tc.span.start);
          const target = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
          const byLine = skipped.get(change.fileName) ?? new Map();
          byLine.set(target, tc.newText.trim());
          skipped.set(change.fileName, byLine);
        }
        if (writable.length === 0) continue;
        for (const tc of writable.sort((a, b) => b.span.start - a.span.start)) {
          text = text.slice(0, tc.span.start) + tc.newText + text.slice(tc.span.start + tc.span.length);
        }
        setText(change.fileName, text);
        edits.set(change.fileName, (edits.get(change.fileName) ?? 0) + writable.length);
        changed += writable.length;
      }
    }
    if (changed === 0) break;
  }
  const after = count();
  const rel = (/** @type {string} */ f) => toPosix(path.relative(root, f));
  /** @type {JsdocAny[]} */
  const anys = [];
  for (const [file, text] of texts) {
    const original = new Set(readFileSync(file, "utf8").split("\n"));
    text.split("\n").forEach((line, i) => {
      if (original.has(line) || !isJsdocLine(line)) return;
      if (ANY_RE.test(line)) anys.push({ file: rel(file), line: i + 1, kind: "any", text: line.trim() });
      else if (NEVER_ARRAY_RE.test(line)) anys.push({ file: rel(file), line: i + 1, kind: "never[]", text: line.trim() });
    });
  }
  for (const [file, byLine] of skipped) {
    const lines = (readText(file) ?? "").split("\n");
    for (const [target, jsdoc] of byLine) {
      anys.push({ file: rel(file), line: lines.indexOf(target) + 1, kind: "never[]", text: `書かなかった: ${oneLine(jsdoc)}` });
    }
  }
  anys.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return {
    lib,
    before,
    after,
    files: [...texts].map(([file, text]) => ({ file: rel(file), edits: edits.get(file) ?? 0, text })).sort((a, b) => a.file.localeCompare(b.file)),
    anys,
  };
}

/**
 * @param {string} root
 * @param {string[]} [argv]
 * @param {{ stdout?: { write: (s: string) => unknown } }} [io]
 * @returns {number}
 */
export function runJsdoc(root, argv = [], { stdout = process.stdout } = {}) {
  const wanted = [];
  let apply = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--json") json = true;
    else if (arg === "--lib" && argv[i + 1] && !argv[i + 1].startsWith("--")) wanted.push(argv[++i]);
    else if (arg.startsWith("--lib=") && arg.length > 6) wanted.push(arg.slice(6));
    else if (arg !== "--") {
      stdout.write(`lib-package jsdoc: 知らない引数 ${arg}(${USAGE})\n`);
      return 2;
    }
  }
  const declared = listDeclaredLibs(root);
  const unknown = wanted.filter((lib) => !declared.includes(lib));
  if (unknown.length > 0) {
    stdout.write(`lib-package jsdoc: package.json を持つ lib にない名前 ${unknown.join(", ")}(${USAGE})\n`);
    return 2;
  }
  const ancestors = new Set(loadCatalogOwnership({ repoRoot: root, folder: LIB_DIR }).upstreamPaths.map((p) => path.basename(p)));
  const ancestral = wanted.filter((lib) => ancestors.has(lib));
  if (ancestral.length > 0) {
    stdout.write(`lib-package jsdoc: 祖先の lib ${ancestral.join(", ")} の中は書きません(直すなら /order <直接の親>)\n`);
    return 2;
  }
  const targets = (wanted.length > 0 ? wanted : declared.filter((lib) => !ancestors.has(lib))).filter((lib) => hasJsFiles(root, lib) && (readLibPackage(root, lib)?.problems.length ?? 1) === 0);
  const skipped = [];
  const plans = [];
  for (const lib of targets) {
    if (compareTsconfig(root, lib).length > 0) {
      skipped.push(lib);
      continue;
    }
    plans.push(planLib(root, lib));
  }
  if (apply) for (const plan of plans) for (const f of plan.files) writeFileSync(path.join(root, f.file), f.text);
  if (json) {
    const strip = ({ text, ...rest }) => rest;
    stdout.write(`${JSON.stringify({ apply, skipped, libs: plans.map((p) => ({ ...p, files: p.files.map(strip) })) }, null, 2)}\n`);
    return 0;
  }
  for (const lib of skipped) stdout.write(`飛ばした ${lib}: tsconfig.json が期待と食い違う(pnpm check lib-package が直す行を出す)\n`);
  for (const plan of plans) {
    if (plan.files.length === 0 && plan.anys.length === 0) continue;
    stdout.write(`${plan.lib}: 暗黙の any ${plan.before} → ${plan.after}\n`);
    for (const f of plan.files) stdout.write(`  ${f.file} ${f.edits} 箇所\n`);
    for (const a of plan.anys) stdout.write(`  ${a.kind} ${a.file}:${a.line} ${a.text}\n`);
  }
  const edits = plans.reduce((n, p) => n + p.files.reduce((m, f) => m + f.edits, 0), 0);
  const files = plans.reduce((n, p) => n + p.files.length, 0);
  const anys = plans.reduce((n, p) => n + p.anys.length, 0);
  stdout.write(
    `lib-package jsdoc: ${apply ? "書いた" : "書く(dry-run、書くのは --apply)"} ${edits} 箇所 / ${files} ファイル・any / never[] ${anys}(本当の型に直す)・lib ${plans.length}${skipped.length ? `・飛ばした ${skipped.length}` : ""}\n`,
  );
  return 0;
}
