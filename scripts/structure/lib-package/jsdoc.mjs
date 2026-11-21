// scripts/structure/lib-package/jsdoc.mjs
//
// 動き jsdoc: 閉じた lib の JS(.mjs / .js)の暗黙の any に、使われ方から推した型を JSDoc で書く(TypeScript の codefix inferFromUsage)。
// 実行: pnpm check lib-package -- jsdoc [--lib <名前>]... [--apply] [--json](振り分けは check.mjs)。既定は dry-run(書かない)。
// - 対象: package.json と単体用 tsconfig.json を持ち、JS のファイルを持つ lib(--lib で絞る)。tsconfig が期待と食い違う lib は飛ばして名前を出す
// - lib の単体用 tsconfig で言語サービスを立て、lib の中の JS ファイルの暗黙の any の診断(IMPLICIT_ANY_CODES)に codefix を当てる。
//   1 つ書くと次の推しが変わるので、変わらなくなるまで(最大 ROUNDS 回)繰り返す。書くのは lib の中のファイルだけ
// - 推せずに {any} と書いた所は一覧に出す(人が本当の型に直す)。暗黙の any 以外の型の誤りは直さない(pnpm check lib-package が名指しする)
// - 緩めない: 単体用 tsconfig の形は変えない(閉じた .mjs の lib は JSDoc で strict の型検査を通す。README「lib の tsconfig.json」)
// - exit 0(書いた・書く物が無い)/ 2 = 引数の誤り・知らない lib

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { LIB_DIR } from "../../../src/lib/libPackage/index.mjs";
import { listDeclaredLibs, readLibPackage } from "../../../src/lib/libPackage/node.mjs";
import { compareTsconfig, hasJsFiles } from "./standalone.mjs";

/** 暗黙の any の診断(引数・変数・分割代入・戻り値・メンバー・this・rest など) */
export const IMPLICIT_ANY_CODES = new Set([7005, 7006, 7008, 7010, 7011, 7019, 7022, 7023, 7024, 7031, 7034, 7043, 7044, 7045, 7046, 7047, 7048, 7049, 7050]);
/** codefix の id(JS では JSDoc の @param / @type / @returns を書く) */
const FIX_ID = "inferFromUsage";
const ROUNDS = 4;
const JS_FILE_RE = /\.(mjs|js)$/;
/** 推せずに any と書いた JSDoc の型(人が直す所) */
const ANY_RE = /\{[^{}\n]*\bany\b[^{}\n]*\}/;

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
 * @returns {{ lib: string, before: number, after: number, files: { file: string, edits: number, text: string }[], anys: { file: string, line: number, text: string }[] }}
 */
export function planLib(root, lib) {
  const { service, files, texts, setText, readText } = libService(root, lib);
  const implicitAny = (/** @type {string} */ f) => service.getSemanticDiagnostics(f).filter((d) => IMPLICIT_ANY_CODES.has(d.code));
  const count = () => files.reduce((n, f) => n + implicitAny(f).length, 0);
  const before = count();
  /** @type {Map<string, number>} */
  const edits = new Map();
  for (let round = 0; round < ROUNDS; round++) {
    let changed = 0;
    for (const file of files) {
      if (implicitAny(file).length === 0) continue;
      const fix = service.getCombinedCodeFix({ type: "file", fileName: file }, FIX_ID, {}, {});
      for (const change of fix.changes) {
        // lib の外(依存の lib・棚)には書かない
        if (!files.includes(change.fileName) || change.textChanges.length === 0) continue;
        let text = readText(change.fileName) ?? "";
        for (const tc of [...change.textChanges].sort((a, b) => b.span.start - a.span.start)) {
          text = text.slice(0, tc.span.start) + tc.newText + text.slice(tc.span.start + tc.span.length);
        }
        setText(change.fileName, text);
        edits.set(change.fileName, (edits.get(change.fileName) ?? 0) + change.textChanges.length);
        changed += change.textChanges.length;
      }
    }
    if (changed === 0) break;
  }
  const after = count();
  const rel = (/** @type {string} */ f) => toPosix(path.relative(root, f));
  const anys = [];
  for (const [file, text] of texts) {
    const original = readFileSync(file, "utf8").split("\n");
    text.split("\n").forEach((line, i) => {
      if (ANY_RE.test(line) && line.includes("@") && !original.includes(line)) anys.push({ file: rel(file), line: i + 1, text: line.trim() });
    });
  }
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
  const targets = (wanted.length > 0 ? wanted : declared).filter((lib) => hasJsFiles(root, lib) && (readLibPackage(root, lib)?.problems.length ?? 1) === 0);
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
    if (plan.files.length === 0) continue;
    stdout.write(`${plan.lib}: 暗黙の any ${plan.before} → ${plan.after}\n`);
    for (const f of plan.files) stdout.write(`  ${f.file} ${f.edits} 箇所\n`);
    for (const a of plan.anys) stdout.write(`  any ${a.file}:${a.line} ${a.text}\n`);
  }
  const edits = plans.reduce((n, p) => n + p.files.reduce((m, f) => m + f.edits, 0), 0);
  const files = plans.reduce((n, p) => n + p.files.length, 0);
  const anys = plans.reduce((n, p) => n + p.anys.length, 0);
  stdout.write(
    `lib-package jsdoc: ${apply ? "書いた" : "書く(dry-run、書くのは --apply)"} ${edits} 箇所 / ${files} ファイル・{any} ${anys}(本当の型に直す)・lib ${plans.length}${skipped.length ? `・飛ばした ${skipped.length}` : ""}\n`,
  );
  return 0;
}
