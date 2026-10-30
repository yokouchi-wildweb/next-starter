// page 層の規律検査(純粋関数、副作用なし)。
// screens.test.mjs が src/app/**/page.tsx を自動検出してこれらを適用する。
// fork が独自の検査を書くときもここを import する(screens.test.mjs は import した時点でテストを登録する)。
// 設計: src/lib/screens/README.md

/**
 * コメントを除去する(行コメントとブロックコメント)。
 * 文字列・テンプレートリテラルの中は触らず、行コメント内の「/」+「*」をブロックコメントの開始と誤認しない
 * (正規表現 2 本の置換だと `// see /api/me/` + `**` の後ろを次の `*` + `/` まで飲み込む)。
 * 行コメントは改行を残して消す(行番号を保つ)。
 * 既知の限界: 正規表現リテラルは追跡しない。`//` や引用符・バッククォートを含む正規表現が
 * page.tsx / Screen / loader にあると、その行以降の判定がずれることがある(検査対象のファイルでは稀)。
 */
export function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    // 文字列・テンプレートリテラル: 終端までそのまま出力
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < n) {
        const c = src[i];
        out += c;
        i += 1;
        if (c === "\\") {
          if (i < n) {
            out += src[i];
            i += 1;
          }
          continue;
        }
        if (c === quote) break;
        if (quote !== "`" && c === "\n") break;
      }
      continue;
    }
    // 行コメント: 改行まで捨てる(改行は残す)
    if (ch === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i += 1;
      continue;
    }
    // ブロックコメント: 対応する終端まで捨てる(中の改行は残す)
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") out += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** page.tsx が Screen を置けるディレクトリ(既定画面 / 下流の差し替え画面) */
export const SCREEN_DIRS = ["_screen", "_components"];

/** 提供者(upstream)の既定の実装を置くディレクトリ。fork のカスタムは隣にドット区切り名で置く(W) */
export const DEFAULT_IMPL_DIRS = ["_screen", "_layout"];

/**
 * DEFAULT_IMPL_DIRS 配下のドット区切り名のファイル(拡張子を除いた名前に "." を含む: `UserLayout.custom.tsx`)を返す。
 * ドット区切り名 = fork のカスタムの印なので、upstream はこれを作らない(test:screens が Tier1 でだけ検査する)。
 * `*.test.*` は除く(test はカスタムではない)
 * @param {string[]} files repo 相対パス
 */
export function findDotNamedFiles(files) {
  return files.filter((file) => {
    const segments = file.split("/");
    const base = segments.pop();
    if (!segments.some((segment) => DEFAULT_IMPL_DIRS.includes(segment))) return false;
    const stem = base.replace(/\.[^.]+$/, "");
    // test(`UserLayout.test.tsx`)はカスタムではない(既定の隣に置いてよい)
    if (/\.test$/.test(stem)) return false;
    return stem.includes(".");
  });
}

/** fork 所有のディレクトリ(下流の差し替え画面と page 専用部品)。upstream はここにファイルを置かない */
export const FORK_OWNED_DIR = "_components";

/**
 * src/app 配下で FORK_OWNED_DIR のセグメントを持つファイルを返す。
 * `_` の意味は場所で違う: `_screen/`・`_layout/` = 提供者の既定、`_components/` = fork 所有。
 * upstream が `_components/` に置くと fork の置き場と衝突するので、test:screens が Tier1 でだけ検査する
 * @param {string[]} files repo 相対パス
 */
export function findForkOwnedDirFiles(files) {
  return files.filter((file) => file.startsWith("src/app/") && file.split("/").slice(0, -1).includes(FORK_OWNED_DIR));
}

/** Next.js が page.tsx で認める設定 export の名前(値は page.tsx 自体に書く。Next が静的解析するため re-export 不可) */
const PAGE_CONFIG_EXPORTS = [
  "metadata",
  "viewport",
  "dynamic",
  "revalidate",
  "dynamicParams",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
];

/** Screen のファイルから default と一緒に re-export してよい名前(Next が実行時に読む値・関数) */
export const REEXPORTABLE_FROM_SCREEN = ["metadata", "generateMetadata", "viewport", "generateViewport"];

/**
 * `start` 以降で最初に現れる open と対応する close の位置(括弧の釣り合い)を返す。
 * 文字列リテラル・テンプレートリテラル内の括弧は数えない。見つからなければ -1
 */
export function findBalancedEnd(src, start, open, close) {
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
  // `{...} satisfies Metadata` / `{...} as const` の後置を一緒に消す
  const suffix = /^\s*(satisfies|as)\s+[\w.<>]+/.exec(src.slice(cut));
  if (suffix) cut += suffix[0].length;
  if (src[cut] === ";") cut += 1;
  return src.slice(0, m.index) + src.slice(cut);
}

/** `export async function generateMetadata(...) {...}` / `generateViewport` を 1 つ取り除く */
function stripGenerateMetadata(src) {
  const m = /export\s+(async\s+)?function\s+(generateMetadata|generateViewport)\s*\(/.exec(src);
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

/** ルート内 loader のファイル名(拡張子なし)。`<route>/_screen/loader.ts`(下流の差し替えなら `_components/loader.ts`) */
export const ROUTE_LOADER_FILE = "loader";

/**
 * page.tsx が許される import 元か。
 * 設定 export(metadata / generateMetadata)に必要なもの: next(型)、lib、config、ルート内 loader。
 * 画面ロジックに当たるもの(セクションコンテナ・hook・next/navigation 等)は不可
 */
function isAllowedImportSource(source) {
  if (source === "next") return true;
  if (/^@\/lib\//.test(source)) return true;
  if (/^@\/config\//.test(source)) return true;
  if (SCREEN_DIRS.some((dir) => source === `./${dir}/${ROUTE_LOADER_FILE}`)) return true;
  return false;
}

/** layout.tsx のスイッチ先のディレクトリ(既定の組み立て `_layout/<Name>Layout.tsx`、fork のカスタムはその隣のドット区切り名) */
export const LAYOUT_DIRS = ["_layout"];

/** スイッチの種類ごとの文言(page と layout は同じ検査関数を共有する。報告書 §2「Screen と Layout は同じ概念の対」) */
const SWITCH_KINDS = {
  page: { file: "page.tsx", dirs: SCREEN_DIRS, target: "Screen", example: "XScreen" },
  layout: { file: "layout.tsx", dirs: LAYOUT_DIRS, target: "組み立て", example: "XLayout" },
};

/**
 * page.tsx / layout.tsx を解析し、1 行スイッチ形かどうかと参照先を返す(共通の本体)。
 * 許されるもの: `./<dir>/<X>` からの `export { <Name> as default[, metadata, generateMetadata] }` 1 つ、
 * 設定 export(metadata / dynamic 等)、generateMetadata、それらに必要な import。
 * @param {string} source ファイルの内容
 * @param {"page" | "layout"} kind
 * @returns {{ problems: string[], target: { screenDir: string, file: string, name: string } | null }}
 *   problems が空ならスイッチ形。target は参照先(screenDir = 参照先のディレクトリ名、file = import パスの末尾、name = default に束ねた export 名)
 */
function parseSwitchModule(source, kind) {
  const { file: fileLabel, dirs, target: targetLabel, example } = SWITCH_KINDS[kind];
  const dirLabel = dirs.map((dir) => `./${dir}/`).join(" または ");
  const problems = [];
  let target = null;
  let src = stripComments(source);

  // 1. 許されたディレクトリからの re-export がちょうど 1 つ(default + 許可された名前のみ)
  const reexportRe = new RegExp(`export\\s*\\{([^}]*)\\}\\s*from\\s*["']\\.\\/(${dirs.join("|")})\\/([\\w./-]+?)["']\\s*;?`, "g");
  const reexports = [...src.matchAll(reexportRe)];
  if (reexports.length !== 1) {
    problems.push(`${dirLabel} からの \`export { X as default }\` が 1 つだけ必要(${reexports.length} 個)`);
  } else {
    const [whole, names, screenDir, file] = reexports[0];
    const specifiers = names.split(",").map((s) => s.trim()).filter(Boolean);
    const defaultSpec = specifiers.find((s) => /\s+as\s+default$/.test(s));
    if (!defaultSpec) {
      problems.push("re-export に `X as default` が無い");
    } else {
      const name = defaultSpec.replace(/\s+as\s+default$/, "").trim();
      target = { screenDir, file: file.replace(/\.tsx?$/, ""), name };
    }
    for (const spec of specifiers) {
      if (spec === defaultSpec) continue;
      if (REEXPORTABLE_FROM_SCREEN.includes(spec)) continue;
      if (spec === "default") {
        problems.push(`${targetLabel} は default export しない。\`export { ${example} as default } from ...\` の形で束ねる`);
      } else if (PAGE_CONFIG_EXPORTS.includes(spec)) {
        problems.push(`\`${spec}\` は ${targetLabel} から re-export できない(Next が静的解析するため ${fileLabel} 自体に書く)`);
      } else {
        problems.push(`${targetLabel} から re-export できる名前は default と ${REEXPORTABLE_FROM_SCREEN.join(" / ")} だけ(${spec})`);
      }
    }
    src = src.replace(whole, "");
  }

  // 2. import は許可された元だけ
  for (let hit = stripImport(src); hit; hit = stripImport(src)) {
    src = hit.src;
    if (!isAllowedImportSource(hit.source)) {
      problems.push(`${fileLabel} で import できない: "${hit.source}"(${kind === "page" ? "画面ロジックは Screen へ" : "枠の組み立ては _layout/ へ"})`);
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
  return { problems, target };
}

/**
 * page.tsx を解析し、スイッチ形かどうかと参照先を返す。
 * 許されるもの: `./_screen/<X>` または `./_components/<X>` からの `export { <Name> as default[, metadata, generateMetadata] }` 1 つ、
 * 設定 export(metadata / dynamic 等)、generateMetadata、それらに必要な import。
 * @param {string} source page.tsx の内容
 * @returns {{ problems: string[], target: { screenDir: string, file: string, name: string } | null }}
 *   problems が空ならスイッチ形。target は参照先(screenDir = "_screen" | "_components"、file = import パスの末尾、name = default に束ねた export 名)
 */
export function parseSwitchPage(source) {
  return parseSwitchModule(source, "page");
}

/**
 * 枠を描く layout.tsx を解析し、1 行スイッチ形かどうかと参照先を返す(page.tsx と同じ検査。参照先は `./_layout/<X>`)。
 * 例: `export { UserLayout as default } from "./_layout/UserLayout";`
 * @param {string} source layout.tsx の内容
 * @returns {{ problems: string[], target: { screenDir: string, file: string, name: string } | null }} screenDir は常に "_layout"
 */
export function parseSwitchLayout(source) {
  return parseSwitchModule(source, "layout");
}

/**
 * layout のスイッチ先(`_layout/<X>.tsx`)の検査。`<name>` を named export し、default export しない。
 * Screen と違い "use client" は可(枠は Provider や表示状態を持つ client の組み立てになりうる)
 * @param {string} source スイッチ先の内容
 * @param {string} name 期待する named export 名
 */
export function checkLayoutTarget(source, name) {
  const problems = [];
  const src = stripComments(source);
  const declared = new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${name}\\b`).test(src);
  const barrel = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(src);
  if (!declared && !barrel) problems.push(`\`export function ${name}\` を持たない`);
  if (/export\s+default/.test(src)) problems.push("default export しない(layout.tsx が as default で再 export する)");
  return problems;
}

/**
 * page.tsx の検査(互換 API)。問題があれば理由の配列を返す。
 * @param {string} source page.tsx の内容
 * @param {string} [screen] 期待する Screen 名(省略時は名前を問わない)。指定時は `./_screen/<screen>` への参照であること
 */
export function checkSwitchPage(source, screen) {
  const { problems, target } = parseSwitchPage(source);
  if (screen && target) {
    if (target.screenDir !== "_screen" || target.file !== screen) {
      problems.push(`import 先が ./_screen/${screen} ではない(./${target.screenDir}/${target.file})`);
    }
    if (target.name !== screen) problems.push(`re-export 名が ${screen} ではない(${target.name})`);
  }
  return problems;
}

/**
 * Screen ファイルの検査。問題があれば理由の配列を返す。
 * - `<name>` を named export している(関数 / const / barrel の `export { name }` のいずれか)
 * - default export しない(page.tsx が as default で再 export する)
 * - `"use client"` を持たない(Screen は Server Component。hook を使う部分はセクションコンテナへ下ろす)
 * @param {string} source Screen ファイルの内容
 * @param {string} name 期待する named export 名
 */
export function checkScreenFile(source, name) {
  const problems = [];
  const src = stripComments(source);
  const declared = new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${name}\\b`).test(src);
  const barrel = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(src);
  if (!declared && !barrel) {
    problems.push(`\`export function ${name}\` を持たない`);
  }
  if (/export\s+default/.test(src)) {
    problems.push("default export しない(page.tsx が as default で再 export する)");
  }
  if (/^\s*["']use client["']/m.test(src)) {
    problems.push('"use client" を持つ(Screen は Server Component。hook を使う部分はセクションコンテナへ下ろす)');
  }
  return problems;
}

/**
 * Screen は `@/features/<domain>/components/` 配下のセクションコンテナを読み、その内側(部品、契約外)を直接読まない(must-read §4)。
 * 「部品を持つコンテナ」= `index.tsx` を持つディレクトリ。import 先の途中のディレクトリがコンテナなら違反。
 * コンテナでないディレクトリ(`Admin/` `common/` などのグループ分け、`index.ts` だけの barrel)は名前空間として通す。
 * `<Name>/index` は `<Name>` と同じ扱い。features 以外(components/ lib/ など)と相対 import は対象外
 * @param {string} source
 * @param {{ isContainerDir?: (dirSpec: string) => boolean }} [options]
 *   isContainerDir: `@/features/.../components/<a>`(import 指定子の形、末尾 / 無し)がコンテナか。
 *   ファイルシステムを見るのは呼び出し側(この関数は純粋)。省略時は全てコンテナ扱い(入れ子の import は全て違反)
 * @returns {string[]} 違反した import 元の説明(空なら合格)
 */
export function checkScreenImports(source, options) {
  const isContainerDir = options?.isContainerDir ?? (() => true);
  const problems = [];
  const src = stripComments(source);
  const re = /(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1];
    const path = /^(@\/features\/(?:core\/)?[^/]+\/components)\/(.+)$/.exec(spec);
    if (!path) continue;
    const segments = path[2].split("/");
    if (segments[segments.length - 1] === "index") segments.pop();
    for (let i = 1; i < segments.length; i++) {
      const dirSpec = `${path[1]}/${segments.slice(0, i).join("/")}`;
      if (isContainerDir(dirSpec)) {
        problems.push(
          `${spec}: セクションコンテナ ${segments.slice(0, i).join("/")}(index.tsx を持つ)の内側(部品)を Screen から直接読んでいる(コンテナ自体を読む)`,
        );
        break;
      }
    }
  }
  return problems;
}

/**
 * Screen ファイルが barrel(`export { X } from "./Y"`)なら、実体のファイル名(拡張子なし)を返す。そうでなければ null
 */
export function barrelTarget(source, name) {
  const src = stripComments(source);
  const m = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']\\./([\\w./-]+?)["']`).exec(src);
  return m ? m[1].replace(/\.tsx?$/, "") : null;
}

/**
 * 再 export しか持たないファイルか(barrel / 旧パス互換の shim)。
 * 全ての export 文が `from` 句付き(`export { X } from` / `export type { X } from` / `export * from` / `export * as ns from`)なら true。
 * 宣言や `export { local }`(from 無し)が 1 つでもあれば false。loader の検査対象から外すために使う(本体は別の場所にある)
 */
export function isReexportOnlyFile(source) {
  const src = stripComments(source);
  if (!/\bexport\b/.test(src)) return false;
  const rest = src.replace(/export\s+(type\s+)?(\*(\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["'][^"']+["']\s*;?/g, "");
  return !/\bexport\b/.test(rest);
}

/** 相対 import(`./x` / `../x`)を from ファイルの位置から解決する(node:path に依存しない。`/` 区切り、`\` は `/` に正規化) */
function resolveRelative(fromFile, source) {
  const segments = fromFile.replace(/\\/g, "/").split("/").slice(0, -1);
  for (const seg of source.split("/")) {
    if (seg === "..") segments.pop();
    else if (seg !== ".") segments.push(seg);
  }
  return segments.join("/");
}

/**
 * loader が import してはいけない相手: `_components/`(契約外の部品)と Screen ファイル。型だけの import も不可(契約の型を契約外が決める逆転になる)。
 * 相対 import は loader の場所(path)から解決して判定する(`_components/loader.ts` からの `./Part` は `_components/` 内を指す)。
 * Screen 名の判定は相対 import か `_screen/` / `_components/` 配下に限る(`features/<domain>/types/XScreen` のような型ファイルを誤検出しない)
 */
function isInvertedLoaderImport(source, loaderPath) {
  const resolved = /^\.\.?\//.test(source) && loaderPath ? resolveRelative(loaderPath, source) : source;
  if (/(^|\/)_components(\/|$)/.test(resolved)) return true;
  const screenLike = /(^\.\.?\/|\/_screen\/|\/_components\/)/.test(source);
  return screenLike && /(^|\/)[A-Z]\w*Screen(\.tsx?|\/index(\.tsx?)?)?$/.test(source);
}

/**
 * loader ファイルの検査。問題があれば理由の配列を返す
 * - `import "server-only"` / React の `cache()` / `load<Xxx>` の export
 * - `cache()` は中身が純粋(URL 解釈だけ・redirect だけ)でも必須。一律にして「後から取得を足したときの付け忘れ」を無くす
 * - DTO 型は loader が所有する: `_components/` や Screen からの import(type 含む)は不可
 * - 主体は guard.ts の createLoader が load の ctx.user で渡す(セッション API の import は lint page-authz/session-api-callsite が止める。
 *   フォルダ名 `(protected)` による判定は持たない)
 * @param {string} source loader の内容
 * @param {{ path?: string }} [options] path = repo 相対パス(相対 import の解決に使う)
 */
export function checkLoaderFile(source, options) {
  const { path = "" } = options ?? {};
  const problems = [];
  const src = stripComments(source);
  if (!/import\s+["']server-only["']/.test(src)) problems.push('import "server-only" が無い');
  // createLoader(最寄りの guard.ts の設定済み Factory)は key のプリミティブで cache を張るので cache() と同じ扱い
  if (!/\b(cache|createLoader)\(/.test(src)) problems.push("React の cache() か guard.ts の createLoader で包まれていない");
  if (!/export\s+(const|async\s+function|function)\s+load[A-Z]\w*/.test(src)) problems.push("load<Name> を export していない");
  for (const m of src.matchAll(/\b(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']/g)) {
    if (isInvertedLoaderImport(m[1], path)) problems.push(`${m[1]} を import している(DTO 型は loader が定義し、部品・Screen 側が loader から import する)`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// 守りの鎖の解析(ルート地図の verified と test:screens の D21 が共有する。字面だけを読む)
// page.tsx → 採用 Screen → 同じルートの loader → 最寄りの guard.ts → extend の親 → root(defineRootGuard)
// ---------------------------------------------------------------------------

/**
 * JS のリテラル(オブジェクト・配列・文字列・数値・真偽・null)を読む小さな解析器。
 * 識別子・呼び出し・スプレッド等の字面で読めない値は `{ expr: "<元の字面>" }` として返す(呼び手が可否を決める)。
 * @param {string} text
 * @returns {unknown}
 */
export function parseLiteral(text) {
  let i = 0;
  const src = text;
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i += 1;
  };
  const expr = (start) => {
    // 値の終わり(同じ深さの , } ])まで読み、字面のまま返す
    let depth = 0;
    let quote = null;
    for (; i < src.length; i += 1) {
      const ch = src[i];
      if (quote) {
        if (ch === "\\") i += 1;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if ("([{".includes(ch)) depth += 1;
      else if (")]}".includes(ch)) {
        if (depth === 0) break;
        depth -= 1;
      } else if (ch === "," && depth === 0) break;
    }
    return { expr: src.slice(start, i).trim() };
  };
  const value = () => {
    ws();
    const start = i;
    const ch = src[i];
    if (ch === "{") {
      i += 1;
      const obj = {};
      for (;;) {
        ws();
        if (src[i] === "}") {
          i += 1;
          return obj;
        }
        if (src.startsWith("...", i)) return { expr: (i = start, expr(start)).expr };
        const km = /^(?:"([^"]*)"|'([^']*)'|([A-Za-z_$][\w$]*))\s*:/.exec(src.slice(i));
        if (!km) {
          i = start;
          return expr(start);
        }
        i += km[0].length;
        obj[km[1] ?? km[2] ?? km[3]] = value();
        ws();
        if (src[i] === ",") i += 1;
      }
    }
    if (ch === "[") {
      i += 1;
      const arr = [];
      for (;;) {
        ws();
        if (src[i] === "]") {
          i += 1;
          return arr;
        }
        arr.push(value());
        ws();
        if (src[i] === ",") i += 1;
      }
    }
    const sm = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/.exec(src.slice(i));
    if (sm) {
      i += sm[0].length;
      ws();
      if (i < src.length && !",}]".includes(src[i])) {
        i = start;
        return expr(start);
      }
      return (sm[1] ?? sm[2]).replace(/\\(.)/g, "$1");
    }
    const lm = /^(true|false|null|-?\d+(?:\.\d+)?)(?![\w$])/.exec(src.slice(i));
    if (lm) {
      const save = i;
      i += lm[0].length;
      ws();
      if (i >= src.length || ",}]".includes(src[i])) return JSON.parse(lm[1]);
      i = save;
    }
    return expr(start);
  };
  const result = value();
  return result;
}

/** parseLiteral の結果に字面で読めない値(`{ expr }`)が含まれるか */
export function hasExpression(value) {
  if (value && typeof value === "object") {
    if (!Array.isArray(value) && Object.keys(value).length === 1 && typeof value.expr === "string") return true;
    return Object.values(value).some(hasExpression);
  }
  return false;
}

/** `name(` の直後の最初の引数の字面(括弧の釣り合いで切る)。見つからなければ null */
function firstCallArgument(src, name) {
  const m = new RegExp(`\\b${name}\\s*(?:<[^()]*>)?\\(`).exec(src);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const end = findBalancedEnd(src, open, "(", ")");
  if (end < 0) return null;
  // 括弧の中の全文と、最初の引数をリテラルとして読んだ値
  const inner = src.slice(open + 1, end);
  return { text: inner.trim(), value: parseLiteral(inner) };
}

/** 名前付き import の import 元(`import { a, b as c } from "x"` の a / c)を探す。無ければ null */
function namedImportSource(src, localName) {
  for (const m of src.matchAll(/import\s+(?!type\b)\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    for (const n of names) {
      const parts = n.replace(/^type\s+/, "").split(/\s+as\s+/);
      const local = (parts[1] ?? parts[0]).trim();
      if (local === localName && !/^type\s/.test(n)) return { source: m[2], imported: parts[0].trim() };
    }
  }
  return null;
}

/** import 元(`@/...` / 相対)を repo 相対のファイルに解決する(fileSet で .ts / .tsx / index を探す)。見つからなければ null */
export function resolveImportFile(fromFile, source, fileSet) {
  let base;
  if (source.startsWith("@/")) base = `src/${source.slice(2)}`;
  else if (/^\.\.?\//.test(source)) base = resolveRelative(fromFile, source);
  else return null;
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base].find((c) => fileSet.has(c)) ?? null;
}

/** 管理画面の共通部品の組(src/wiring/domains.ts)と、それぞれが serviceRegistry から解く操作 */
export const ADMIN_PARTS_OPERATIONS = {
  adminListParts: "search",
  adminEditParts: "get",
  adminCreateParts: "create",
  adminSortParts: "searchForSorting",
};

/**
 * D21: Screen が同じルートの loader を import し、Screen 本体の最上位で await しているか。
 * @param {string} source Screen ファイル
 * @param {string} name Screen の名前(named export)
 * @returns {{ problems: string[], loaderName: string | null, loaderImport: string | null }}
 */
export function checkScreenLoaderCall(source, name) {
  const src = stripComments(source);
  // 同じルートの loader: Screen と同じフォルダの ./loader か、_components の差し替え Screen から ../_screen/loader・../_components/loader
  const imp = /import\s*\{([^}]*)\}\s*from\s*["'](\.\/loader|\.\.\/_screen\/loader|\.\.\/_components\/loader)["']/.exec(src);
  const loaderNames = imp
    ? imp[1].split(",").map((s) => s.trim()).filter((s) => /^load[A-Z]\w*$/.test(s))
    : [];
  if (loaderNames.length === 0) return { problems: ["同じルートの loader(./loader の load<Name>)を import していない"], loaderName: null, loaderImport: null };
  const fm = new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src)
    ?? new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(?:async\\s*)?\\(`).exec(src);
  if (!fm) return { problems: [`${name} の関数本体が読めない(export function / export const = (…) => の形にする)`], loaderName: null, loaderImport: null };
  const paramsEnd = findBalancedEnd(src, fm.index + fm[0].length - 1, "(", ")");
  const bodyOpen = paramsEnd < 0 ? -1 : src.indexOf("{", paramsEnd);
  if (bodyOpen < 0) return { problems: [`${name} の関数本体が読めない`], loaderName: null, loaderImport: null };
  // 本体の最上位(深さ 0)の文を、最上位の最初の return まで集める(if / try / コールバックの中の await は数えない)。
  // return 以降(JSX)は読まない: JSX のテキストの引用符で括弧の釣り合いが崩れるため。loader の await は return より前に置く
  let depth = 0;
  let top = "";
  let quote = null;
  for (let i = bodyOpen + 1; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      if (depth === 0) top += " ";
      continue;
    }
    if (depth === 0 && /^return\b/.test(src.slice(i, i + 7)) && /[\s;{}]/.test(src[i - 1])) break;
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      if (depth === 0) top += " ";
      continue;
    }
    if ("({[".includes(ch)) {
      if (depth === 0) top += ch;
      depth += 1;
      continue;
    }
    if (")}]".includes(ch)) {
      if (depth === 0) break; // 本体の終わり
      depth -= 1;
      if (depth === 0) top += ch;
      continue;
    }
    if (depth === 0) top += ch;
  }
  const called = loaderNames.find((loader) =>
    new RegExp(`(^|[;\\n])\\s*(?:(?:const|let)\\s+[^=;]+=\\s*)?await\\s+${loader}\\s*\\(`).test(top),
  );
  if (!called) {
    return { problems: [`${name} の本体の最上位で await ${loaderNames[0]}(props) を呼んでいない(条件分岐・try・コールバックの中は不可)`], loaderName: null, loaderImport: imp[2] };
  }
  return { problems: [], loaderName: called, loaderImport: imp[2] };
}

/**
 * loader の createLoader の import 元と access を読む。
 * access はオブジェクトの access の字面、または管理画面の共通部品の組(registry:<domain>.<operation>)。
 * @returns {{ problems: string[], guardImport: string | null, access: unknown, allowStatuses: unknown }}
 */
export function parseLoaderGuard(source) {
  const src = stripComments(source);
  const imp = namedImportSource(src, "createLoader");
  if (!imp || imp.imported !== "createLoader") {
    return { problems: ["guard.ts の createLoader を import していない(loader は最寄りの guard.ts の createLoader で作る)"], guardImport: null, access: null, allowStatuses: null };
  }
  const arg = firstCallArgument(src, "createLoader");
  if (!arg) return { problems: ["createLoader(…) の呼び出しが読めない"], guardImport: imp.source, access: null, allowStatuses: null };
  const partsCall = /^(admin(?:List|Edit|Create|Sort)Parts)\s*(?:<[^()]*>)?\(\s*["']([\w]+)["']/.exec(arg.text);
  if (partsCall) {
    const parts = namedImportSource(src, partsCall[1]);
    if (!parts || parts.source !== "@/wiring/domains") {
      return { problems: [`${partsCall[1]} を @/wiring/domains から import していない`], guardImport: imp.source, access: null, allowStatuses: null };
    }
    return {
      problems: [],
      guardImport: imp.source,
      access: { registry: `${partsCall[2]}.${ADMIN_PARTS_OPERATIONS[partsCall[1]]}` },
      allowStatuses: null,
    };
  }
  const config = arg.value;
  if (!config || typeof config !== "object" || Array.isArray(config) || "expr" in config) {
    return { problems: ["createLoader の引数が字面のオブジェクトでない({ access, … } か管理画面の組 admin*Parts(…))"], guardImport: imp.source, access: null, allowStatuses: null };
  }
  if (!("access" in config)) return { problems: ["createLoader に access が無い"], guardImport: imp.source, access: null, allowStatuses: null };
  if (hasExpression(config.access)) {
    return { problems: [`access が字面で読めない(${JSON.stringify(config.access)})`], guardImport: imp.source, access: null, allowStatuses: null };
  }
  return { problems: [], guardImport: imp.source, access: config.access, allowStatuses: config.allowStatuses ?? null };
}

/** guard.ts の方針として地図に載せるキー(この順で出す) */
export const GUARD_POLICY_KEYS = ["access", "allowStatuses", "redirectTo", "forbiddenRedirectTo", "returnBack", "statusRedirects", "setupRedirectTo"];

/**
 * guard.ts を読む: root(@/wiring/pageGuard の defineRootGuard)か、親の extend を import して呼ぶ子か。
 * @returns {{ problems: string[], root: boolean, parentImport: string | null, policy: Record<string, unknown> | null }}
 */
export function parseGuardFile(source) {
  const src = stripComments(source);
  const exportsAll = /export\s+const\s*\{\s*guard\s*,\s*createLoader\s*,\s*extend\s*\}\s*=/.test(src);
  const problems = exportsAll ? [] : ["guard.ts は `export const { guard, createLoader, extend } = …` の形にする"];
  const root = namedImportSource(src, "defineRootGuard");
  let parentImport = null;
  let callee;
  if (root) {
    if (root.source !== "@/wiring/pageGuard") problems.push("defineRootGuard は @/wiring/pageGuard から import する");
    callee = "defineRootGuard";
  } else {
    const ext = [...src.matchAll(/import\s*\{\s*extend(?:\s+as\s+([\w$]+))?\s*\}\s*from\s*["']([^"']+)["']/g)][0];
    if (!ext) return { problems: [...problems, "親の guard.ts の extend を import していない(root 以外は親の extend で作る)"], root: false, parentImport: null, policy: null };
    parentImport = ext[2];
    callee = ext[1] ?? "extend";
  }
  const arg = firstCallArgument(src, callee);
  const policy = arg?.value;
  if (!policy || typeof policy !== "object" || Array.isArray(policy) || "expr" in policy) {
    return { problems: [...problems, `${callee}(…) の方針が字面のオブジェクトでない`], root: Boolean(root), parentImport, policy: null };
  }
  if (hasExpression(policy)) problems.push(`方針に字面で読めない値がある(${JSON.stringify(policy)})`);
  const ordered = {};
  for (const key of GUARD_POLICY_KEYS) if (key in policy) ordered[key] = policy[key];
  for (const key of Object.keys(policy)) if (!GUARD_POLICY_KEYS.includes(key)) problems.push(`方針の未知のキー ${key}`);
  return { problems, root: Boolean(root), parentImport, policy: ordered };
}

/** layout(か 1 行スイッチ先)が `guard()` を呼んでいるか(`./guard` から import して await) */
export function layoutCallsGuard(source) {
  const src = stripComments(source);
  const imp = namedImportSource(src, "guard");
  return Boolean(imp && imp.source === "./guard" && /\bawait\s+guard\s*\(\s*\)/.test(src));
}
