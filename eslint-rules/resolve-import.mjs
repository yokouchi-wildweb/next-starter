// eslint-rules/resolve-import.mjs
//
// import の指定子を repo 相対の実パス(posix、拡張子・index の補完なし)に解く、規則どうしで共有する部品。
// 別名の import で検査を抜けられないよう、書き方によらず同じ実パスに解く:
//   - 相対(./ ../)→ import した側のフォルダから
//   - tsconfig.json の paths(@/* と @/features/<core>/* の別名)→ 一番長く一致した接頭辞の先
//   - baseUrl("." = repo 直下)からの "src/…" 等
//   - パッケージ(next/server 等)→ null
// 解いた先は「そのパスか、その配下か」で比べる(isUnder)。ファイルの有無は見ない(消えたファイルへの import も同じに扱う)。
//
// 併せて、ファイルの import / export … from / dynamic import() / require() を走査する visitor を作る(moduleVisitors)。
// 型だけの import(`import type` / `export type` / 名前付きがすべて type)は typeOnly で渡す。

import { readFileSync } from "node:fs";
import path from "node:path";

const tsconfigCache = new Map();

/** tsconfig.json の baseUrl と paths を読む(コメント・末尾カンマを許す)。読めなければ空 */
function loadTsconfig(repoRoot) {
  if (tsconfigCache.has(repoRoot)) return tsconfigCache.get(repoRoot);
  let config = { baseUrl: ".", paths: {} };
  try {
    const text = readFileSync(path.join(repoRoot, "tsconfig.json"), "utf8")
      .replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, str) => str ?? "")
      .replace(/,(\s*[}\]])/g, "$1");
    const json = JSON.parse(text);
    config = {
      baseUrl: json.compilerOptions?.baseUrl ?? ".",
      paths: json.compilerOptions?.paths ?? {},
    };
  } catch {
    // tsconfig が読めないときは相対と "src/…" だけ解く
  }
  tsconfigCache.set(repoRoot, config);
  return config;
}

const toPosix = (p) => p.split(path.sep).join("/");

/**
 * 指定子を repo 相対の実パスに解く。パッケージなら null
 * @param {string} specifier import の指定子
 * @param {string} importerFile import したファイル(絶対パス)
 * @param {string} repoRoot リポジトリ直下(絶対パス)
 */
export function resolveImport(specifier, importerFile, repoRoot) {
  if (specifier.startsWith("./") || specifier.startsWith("../") || specifier === "." || specifier === "..") {
    return toPosix(path.relative(repoRoot, path.resolve(path.dirname(importerFile), specifier)));
  }
  const { baseUrl, paths } = loadTsconfig(repoRoot);
  let best = null;
  for (const [pattern, targets] of Object.entries(paths)) {
    const star = pattern.indexOf("*");
    const prefix = star >= 0 ? pattern.slice(0, star) : pattern;
    const matches = star >= 0 ? specifier.startsWith(prefix) : specifier === pattern;
    if (!matches || !targets?.length) continue;
    if (!best || prefix.length > best.prefix.length) best = { prefix, target: targets[0], star: star >= 0 };
  }
  if (best) {
    const rest = best.star ? specifier.slice(best.prefix.length) : "";
    const mapped = best.star ? best.target.replace("*", rest) : best.target;
    return toPosix(path.relative(repoRoot, path.resolve(repoRoot, baseUrl, mapped)));
  }
  // baseUrl からの指定(例 "src/lib/routeFactory")。repo の中に実在する先頭のフォルダのときだけ
  const first = specifier.split("/")[0];
  if (first === "src" || first === "scripts" || first === "eslint-rules") {
    return toPosix(path.relative(repoRoot, path.resolve(repoRoot, baseUrl, specifier)));
  }
  return null;
}

/** 解いたパスが base そのものか、その配下か(拡張子の違いは無視: src/lib/x と src/lib/x.ts は同じ) */
export function isUnder(resolved, base) {
  if (!resolved) return false;
  const bare = resolved.replace(/\.(ts|tsx|mts|mjs|js)$/, "");
  return bare === base || resolved === base || resolved.startsWith(`${base}/`);
}

/** ファイルの repo 相対パス(posix) */
export function repoRelative(filename, repoRoot) {
  return toPosix(path.relative(repoRoot, filename));
}

/** ImportDeclaration / Export…Declaration の名前を { name, local, typeOnly }[] に(名前を問わない形なら null) */
function readSpecifiers(node, declarationTypeOnly) {
  if (node.type === "ExportAllDeclaration") return null;
  const specs = node.specifiers ?? [];
  if (node.type === "ImportDeclaration") {
    if (specs.length === 0 || specs.some((s) => s.type !== "ImportSpecifier")) return null;
    return specs.map((s) => ({
      name: s.imported.type === "Identifier" ? s.imported.name : String(s.imported.value),
      local: s.local.name,
      typeOnly: declarationTypeOnly || s.importKind === "type",
    }));
  }
  return specs.map((s) => ({
    name: s.local.type === "Identifier" ? s.local.name : String(s.local.value),
    local: s.local.type === "Identifier" ? s.local.name : String(s.local.value),
    typeOnly: declarationTypeOnly || s.exportKind === "type",
  }));
}

/**
 * import / export from / dynamic import / require を走査して visit({ node, source, specifiers, typeOnly, dynamic }) を呼ぶ。
 * specifiers = null は名前を問わない形(副作用 / namespace / default / dynamic / require)
 */
export function moduleVisitors(visit) {
  const onDeclaration = (node) => {
    if (!node.source || typeof node.source.value !== "string") return;
    const declarationTypeOnly = node.importKind === "type" || node.exportKind === "type";
    const specifiers = readSpecifiers(node, declarationTypeOnly);
    const typeOnly =
      declarationTypeOnly || (Array.isArray(specifiers) && specifiers.length > 0 && specifiers.every((s) => s.typeOnly));
    visit({ node: node.source, source: node.source.value, specifiers, typeOnly, dynamic: false });
  };
  return {
    ImportDeclaration: onDeclaration,
    ExportNamedDeclaration: onDeclaration,
    ExportAllDeclaration: onDeclaration,
    ImportExpression(node) {
      if (node.source.type !== "Literal" || typeof node.source.value !== "string") return;
      visit({ node: node.source, source: node.source.value, specifiers: null, typeOnly: false, dynamic: true });
    },
    CallExpression(node) {
      if (node.callee.type !== "Identifier" || node.callee.name !== "require") return;
      const [arg] = node.arguments;
      if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") return;
      visit({ node: arg, source: arg.value, specifiers: null, typeOnly: false, dynamic: true });
    },
  };
}
