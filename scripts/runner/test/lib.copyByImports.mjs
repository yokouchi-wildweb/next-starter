// scripts/runner/test/lib.copyByImports.mjs — 一時フォルダへリポのファイルを写すテストの共有の部品
//
// テストが命令や生成器を一時フォルダで走らせるとき、写すコードは走らせる入口から import を辿って求める(dpdm、
// pnpm test --changed と同じ道具)。手で挙げるのは、コードが import ではなくファイルとして読むデータだけ。
// コードの置き場が動いても(lib を閉じる・名を変える)テストの一覧を直さずに済む。
// 決まり: .claude/rules/core/scripts.md tests | 使い方: scripts/runner/test/README.md「一時フォルダへリポを写すテスト」

import fs from "node:fs";
import path from "node:path";
import { parseDependencyTree } from "dpdm";
import ts from "typescript";

/**
 * 入口から import で届くファイル(from からの相対)。node_modules・組み込み・from の外は除く
 * @param {string} from リポの根
 * @param {string[]} entries 走らせる入口(from からの相対)
 * @returns {Promise<string[]>}
 */
export async function importedFiles(from, entries) {
  // dpdm は入口を今の作業の場所(process.cwd())からの glob で読み、その外("../")の入口を見つけない。
  // 呼んだその場で(同期のうちに)作業の場所と glob の起点を決めるので、呼ぶ間だけ from へ移ってすぐ戻す
  const back = process.cwd();
  process.chdir(from);
  let pending;
  try {
    // tsconfig は渡さない: dpdm は context の tsconfig.json を自分で見つけて @/ などの paths を解く
    // (渡すと作業の場所と繋いだ道にして読み損ね、paths が効かない)
    pending = parseDependencyTree(entries, {
      context: from,
      transform: false,
      skipDynamicImports: false,
    });
  } finally {
    process.chdir(back);
  }
  const tree = await pending;
  return Object.keys(tree)
    .filter((f) => !f.startsWith("node_modules/") && !f.startsWith("..") && !path.isAbsolute(f))
    .filter((f) => fs.statSync(path.join(from, f), { throwIfNoEntry: false })?.isFile())
    .sort();
}

/**
 * 入口から import で届くコードと、手で挙げるデータを from から to へ写す
 * @param {{ from: string, to: string, entries: string[], data?: string[], nodeModules?: boolean }} options
 *   entries = 走らせる入口(from からの相対) | data = import ではなくファイルとして読む物(ファイルかフォルダ、from からの相対)
 *   nodeModules = true なら to/node_modules を from/node_modules への symlink にする
 * @returns {Promise<string[]>} 写した道(from からの相対)
 */
export async function copyByImports({ from, to, entries, data = [], nodeModules = false }) {
  const copied = [...new Set([...data, ...(await importedFiles(from, entries))])];
  for (const rel of copied) {
    fs.mkdirSync(path.dirname(path.join(to, rel)), { recursive: true });
    fs.cpSync(path.join(from, rel), path.join(to, rel), { recursive: true });
  }
  if (nodeModules) fs.symlinkSync(path.join(from, "node_modules"), path.join(to, "node_modules"), "dir");
  return copied;
}

/**
 * import の指定子(@/… などの tsconfig の paths か相対)を、from の tsconfig.json で from の中のファイルに解く
 * (生成器が書くファイルの import のように、まだファイルが無い物が読む先を求める)。解けない指定子は誤りで止める
 * @param {string} from リポの根(tsconfig.json の置き場)
 * @param {string[]} specifiers
 * @param {string} [issuer] 指定子を書くファイル(from からの相対、相対の指定子の起点)。既定は from の根
 * @returns {string[]} 解いたファイル(from からの相対)
 */
export function resolveSpecifiers(from, specifiers, issuer = "index.ts") {
  const config = ts.readConfigFile(path.join(from, "tsconfig.json"), ts.sys.readFile).config ?? {};
  const options = ts.parseJsonConfigFileContent(config, ts.sys, from).options;
  const host = ts.createCompilerHost(options);
  return specifiers.map((spec) => {
    const resolved = ts.resolveModuleName(spec, path.join(from, issuer), options, host).resolvedModule;
    if (!resolved || resolved.isExternalLibraryImport) throw new Error(`copyBySpecifiers: ${spec} を ${from} の中のファイルに解けない`);
    return path.relative(from, resolved.resolvedFileName);
  });
}

/**
 * 指定子が指すファイルを入口に、copyByImports と同じく写す
 * @param {{ from: string, to: string, specifiers: string[], issuer?: string, data?: string[], nodeModules?: boolean }} options
 * @returns {Promise<string[]>} 写した道(from からの相対)
 */
export async function copyBySpecifiers({ from, to, specifiers, issuer, data, nodeModules }) {
  return copyByImports({ from, to, entries: resolveSpecifiers(from, specifiers, issuer), data, nodeModules });
}
