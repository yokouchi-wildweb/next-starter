// page 層の規律検査(純粋関数、副作用なし)。
// screens.test.mjs がこれを使ってテストを登録する。fork が自前のテストを書くときは
// screens.test.mjs ではなくこのモジュールを import する(screens.test.mjs は import した時点で
// UPSTREAM_ROUTES / FORK_SCREEN_ROUTES のテストを登録してしまう)。
// 設計: src/lib/screens/README.md

/** コメントを除去する(行コメントとブロックコメント) */
export const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** upstream(next-starter)の owner 正規表現。styleTokens.test.mjs の isUpstreamRepo と同じ判定 */
export const UPSTREAM_OWNER = "[:/]yokouchi-wildweb/next-starter(\\.git)?/?$";

/** このリポジトリがルートの所有者か(entry.owner が origin URL に一致するか) */
export function isRouteOwner(entry, originUrl) {
  return new RegExp(entry.owner).test(originUrl);
}

/** Next.js が page.tsx で認める設定 export の名前(値は page.tsx 自体に書く。Next が静的解析するため re-export 不可) */
const PAGE_CONFIG_EXPORTS = [
  "metadata",
  "dynamic",
  "revalidate",
  "dynamicParams",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
];

/** `./_screen/` から default と一緒に re-export してよい名前(Next が実行時に読む値・関数) */
const REEXPORTABLE_FROM_SCREEN = ["metadata", "generateMetadata", "viewport", "generateViewport"];

/**
 * `start` 以降で最初に現れる open と対応する close の位置(括弧の釣り合い)を返す。
 * 文字列リテラル・テンプレートリテラル内の括弧は数えない。見つからなければ -1
 */
function findBalancedEnd(src, start, open, close) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** `export const metadata = {...};` / `export const dynamic = "force-dynamic";` などの設定 export を 1 つ取り除く */
function stripConfigExport(src) {
  const re = new RegExp(`export\\s+(const|let)\\s+(${PAGE_CONFIG_EXPORTS.join("|")})\\b[^=]*=\\s*`);
  const m = re.exec(src);
  if (!m) return null;
  const valueStart = m.index + m[0].length;
  let end;
  if (src[valueStart] === "{" || src[valueStart] === "[") {
    end = findBalancedEnd(src, valueStart, src[valueStart], src[valueStart] === "{" ? "}" : "]");
    if (end < 0) return null;
  } else {
    // プリミティブ値: 行末または ; まで
    const rest = src.slice(valueStart);
    const stop = rest.search(/;|\n/);
    end = valueStart + (stop < 0 ? rest.length : stop) - 1;
  }
  let cut = end + 1;
  if (src[cut] === ";") cut += 1;
  return src.slice(0, m.index) + src.slice(cut);
}

/** `export async function generateMetadata(...) {...}` を 1 つ取り除く */
function stripGenerateMetadata(src) {
  const m = /export\s+(async\s+)?function\s+generateMetadata\s*\(/.exec(src);
  if (!m) return null;
  const parenStart = m.index + m[0].length - 1;
  const parenEnd = findBalancedEnd(src, parenStart, "(", ")");
  if (parenEnd < 0) return null;
  const braceStart = src.indexOf("{", parenEnd);
  if (braceStart < 0) return null;
  const braceEnd = findBalancedEnd(src, braceStart, "{", "}");
  if (braceEnd < 0) return null;
  return src.slice(0, m.index) + src.slice(braceEnd + 1);
}

/** import 文を 1 つ取り除き、import 元を返す */
function stripImport(src) {
  const m = /import\s+(type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']\s*;?/.exec(src);
  if (!m) return null;
  return { src: src.slice(0, m.index) + src.slice(m.index + m[0].length), source: m[2] };
}

/**
 * page.tsx が許される import 元か。
 * 設定 export(metadata / generateMetadata)に必要なもの: next(型)、lib、config、ドメインの loader。
 * 画面ロジックに当たるもの(セクションコンテナ・hook・next/navigation 等)は不可
 */
function isAllowedImportSource(source) {
  if (source === "next") return true;
  if (/^@\/lib\//.test(source)) return true;
  if (/^@\/config\//.test(source)) return true;
  if (/^@\/features\/[^/]+\/services\/server\/loaders\//.test(source)) return true;
  if (/^@\/features\/core\/[^/]+\/services\/server\/loaders\//.test(source)) return true;
  return false;
}

/**
 * page.tsx の本文を検査し、問題があれば理由の配列を返す(空配列 = 合格)。
 * 許されるもの: `./_screen/<screen>` からの `export { <screen> as default[, metadata, generateMetadata] }` 1 つ、
 * 設定 export(metadata / dynamic 等)、generateMetadata、それらに必要な import。
 * @param {string} source page.tsx の内容
 * @param {string} screen 期待する Screen 名
 */
export function checkSwitchPage(source, screen) {
  const problems = [];
  let src = stripComments(source);

  // 1. ./_screen/ からの re-export がちょうど 1 つ(default + 許可された名前のみ)
  const reexports = [...src.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']\.\/_screen\/(\w+)["']\s*;?/g)];
  if (reexports.length !== 1) {
    problems.push(`./_screen/ からの \`export { X as default }\` が 1 つだけ必要(${reexports.length} 個)`);
  } else {
    const [whole, names, file] = reexports[0];
    const specifiers = names.split(",").map((s) => s.trim()).filter(Boolean);
    const defaultSpec = specifiers.find((s) => /\s+as\s+default$/.test(s));
    if (!defaultSpec) {
      problems.push("re-export に `X as default` が無い");
    } else {
      const name = defaultSpec.replace(/\s+as\s+default$/, "").trim();
      if (name !== screen) problems.push(`re-export 名が ${screen} ではない(${name})`);
    }
    if (file !== screen) problems.push(`import 先が ./_screen/${screen} ではない(./_screen/${file})`);
    for (const spec of specifiers) {
      if (spec === defaultSpec) continue;
      if (REEXPORTABLE_FROM_SCREEN.includes(spec)) continue;
      if (PAGE_CONFIG_EXPORTS.includes(spec)) {
        problems.push(`\`${spec}\` は _screen/ から re-export できない(Next が静的解析するため page.tsx 自体に書く)`);
      } else {
        problems.push(`_screen/ から re-export できる名前は default と ${REEXPORTABLE_FROM_SCREEN.join(" / ")} だけ(${spec})`);
      }
    }
    src = src.replace(whole, "");
  }

  // 2. import は許可された元だけ
  for (let hit = stripImport(src); hit; hit = stripImport(src)) {
    src = hit.src;
    if (!isAllowedImportSource(hit.source)) {
      problems.push(`page.tsx で import できない: "${hit.source}"(画面ロジックは _screen/ へ)`);
    }
  }

  // 3. 設定 export と generateMetadata は取り除く(中身は検査しない)
  for (let next = stripConfigExport(src); next !== null; next = stripConfigExport(src)) src = next;
  for (let next = stripGenerateMetadata(src); next !== null; next = stripGenerateMetadata(src)) src = next;

  // 4. 残りは空でなければならない
  const remainder = src.replace(/;/g, "").trim();
  if (remainder) {
    problems.push(`許可されない記述が残っている: ${remainder.split("\n")[0].trim()}`);
  }
  return problems;
}

/**
 * `_screen/<screen>.tsx` の検査。問題があれば理由の配列を返す
 * @param {string} source Screen ファイルの内容
 * @param {string} screen 期待する named export 名
 */
export function checkScreenFile(source, screen) {
  const problems = [];
  const src = stripComments(source);
  if (!new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${screen}\\b`).test(src)) {
    problems.push(`\`export function ${screen}\` を持たない`);
  }
  if (/export\s+default/.test(src)) {
    problems.push("default export しない(page.tsx が as default で再 export する)");
  }
  return problems;
}

/**
 * loader ファイルの検査。問題があれば理由の配列を返す
 * @param {string} source loader の内容
 */
export function checkLoaderFile(source) {
  const problems = [];
  const src = stripComments(source);
  if (!/import\s+"server-only"/.test(src)) problems.push('import "server-only" が無い');
  if (!/\bcache\(/.test(src)) problems.push("React の cache() で包まれていない");
  if (!/export\s+(const|async\s+function|function)\s+load\w+Screen\b/.test(src)) problems.push("load<Name>Screen を export していない");
  return problems;
}
