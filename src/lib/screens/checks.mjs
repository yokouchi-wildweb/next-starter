// page 層の規律検査(純粋関数、副作用なし)。
// screens.test.mjs が src/app/**/page.tsx を自動検出してこれらを適用する。
// fork が独自の検査を書くときもここを import する(screens.test.mjs は import した時点でテストを登録する)。
// 設計: src/lib/screens/README.md

import { classifyDottedName, UI_CONFIG_FILE } from "../districtMap/index.mjs";

/**
 * @typedef {{ screenDir: string, file: string, name: string }} SwitchTarget 1 行スイッチの向け先(screenDir = 向け先のディレクトリ名、file = import パスの末尾、name = default に束ねた export 名)
 * @typedef {"in-screen" | "orphan" | "no-default"} RouteReplaceReason
 * @typedef {{ path: string, reason: RouteReplaceReason }} RouteReplaceProblem
 */

/**
 * 素のオブジェクト(配列・null でない)か
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * コメントを除去する(行コメントとブロックコメント)。
 * 文字列・テンプレートリテラルの中は触らず、行コメント内の「/」+「*」をブロックコメントの開始と誤認しない
 * (正規表現 2 本の置換だと `// see /api/me/` + `**` の後ろを次の `*` + `/` まで飲み込む)。
 * 行コメントは改行を残して消す(行番号を保つ)。
 * 既知の限界: 正規表現リテラルは追跡しない。`//` や引用符・バッククォートを含む正規表現が
 * page.tsx / Screen / loader にあると、その行以降の判定がずれることがある(検査対象のファイルでは稀)。
 * @param {string} src
 * @returns {string}
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

/** 提供者(upstream)の既定の実装を置くディレクトリ。fork の丸ごと置き換えは隣に <名前>.replace.ts(x) で置く(W) */
export const DEFAULT_IMPL_DIRS = ["_screen", "_layout"];

/**
 * DEFAULT_IMPL_DIRS 配下の点つきの名前(テストを除く)と、その形(dottedNames.mjs の classifyDottedName の kind)
 * @param {string[]} files repo 相対パス
 */
function dottedInImplDirs(files) {
  const out = [];
  for (const file of files) {
    const segments = file.split("/");
    const base = segments.pop() ?? "";
    if (!segments.some((segment) => DEFAULT_IMPL_DIRS.includes(segment))) continue;
    const { kind } = classifyDottedName(base);
    // 素の名前とテスト(`UserLayout.test.tsx`、既定の隣に置いてよい)は点つきの名前として扱わない
    if (kind === "plain" || kind === "test") continue;
    out.push({ file, kind, base, dir: segments[segments.length - 1] });
  }
  return out;
}

/**
 * DEFAULT_IMPL_DIRS 配下の fork の置き換えの印(classifyDottedName が replace = 丸ごと置き換え・override = 一部の上書きと判定する名前)を返す。
 * 置き換えの印は fork の物なので upstream はこれを作らない(pnpm test scripts/structure/routes/screens.test.mjs が Tier1 でだけ検査する、設定 D101)。
 * 点つきの名前を全部止めるのではない: 1 行スイッチの既定 `<名前>.default`・枠の描画用の設定 `config.ui.ts`(設定 D38)・テストは印でないので返さない
 * @param {string[]} files repo 相対パス
 */
export function findDotNamedFiles(files) {
  return dottedInImplDirs(files)
    .filter(({ kind }) => kind === "replace" || kind === "override")
    .map(({ file }) => file);
}

/**
 * DEFAULT_IMPL_DIRS 配下で許さない点つきの名前を返す: 許すのは丸ごと置き換え `.replace`・テスト・1 行スイッチの既定 `.default` と、
 * 枠の `_layout/` の直下の描画用の設定 `config.ui.ts`(地区の UI_CONFIG_FILE、設定 D38)だけ。旧い fork の名前の印(`UserLayout.acme.tsx`)・
 * `.override` などは止める。全 Tier で検査する(移し方は dottedNames.mjs の MARKER_MIGRATION_NOTICE)
 * @param {string[]} files repo 相対パス
 */
export function findMarkerNamedFiles(files) {
  return dottedInImplDirs(files)
    .filter(({ kind, base, dir }) => kind !== "replace" && kind !== "default" && !(base === UI_CONFIG_FILE && dir === "_layout"))
    .map(({ file }) => file);
}

/**
 * DEFAULT_IMPL_DIRS 配下の孤立した <名前>.replace.ts(x)(隣に置き換える既定 <名前>.ts(x) か <名前>/index.ts(x) が無い)を返す。全 Tier で検査する
 * @param {string[]} files repo 相対パス(同じ一覧の中で既定を探す)
 */
export function findOrphanReplaceFiles(files) {
  const present = new Set(files);
  return findDotNamedFiles(files).filter((file) => {
    const match = /^(.*)\/([^/]+)\.replace\.tsx?$/.exec(file);
    if (!match) return false;
    const [, dir, name] = match;
    return ![`${name}.tsx`, `${name}.ts`, `${name}/index.tsx`, `${name}/index.ts`].some((rel) => present.has(`${dir}/${rel}`));
  });
}

/**
 * DEFAULT_IMPL_DIRS 配下の <名前>.replace.ts(x) が置き換える既定を持つか(全 Tier。pnpm check extensions の孤立の検査 scripts/structure/extensions/orphans.mjs が回す)。
 * 置き換えられる既定 = そのルートの page.tsx / layout.tsx の 1 行スイッチの向け先(`./_screen/<名前>`・`./_layout/<名前>`、向け先が <名前>.replace でも同じ)か、
 * 隣の 1 行スイッチの既定 <名前>.default.ts(x)。隣に印なしの <名前> があるだけの部品(枠の中の部品など)は置き換えの口でない:
 * fork の部品はルートの _components/ に印なしの名前で置く。
 * `_screen/` の下の .replace は向け先でも .default の隣でも全部 in-screen(_screen/ に fork の物を混ぜない。
 * 画面の丸ごとの差し替えは <ルート>/_components/<X>Screen.tsx + page.tsx のスイッチ、README §1「fork の物は _components/」)
 * @param {string[]} files repo 相対パス
 * @param {(path: string) => string | null} readText page.tsx / layout.tsx の中身
 * @returns {RouteReplaceProblem[]} in-screen = `_screen/` の下 /
 *   orphan = 隣に <名前> も無い / no-default = 隣にあるが既定でない
 */
export function findRouteReplaceProblems(files, readText) {
  const present = new Set(files);
  const targets = new Set();
  for (const file of files) {
    const name = file.slice(file.lastIndexOf("/") + 1);
    const parse = /^page\.tsx?$/.test(name) ? parseSwitchPage : /^layout\.tsx?$/.test(name) ? parseSwitchLayout : null;
    if (!parse || !file.startsWith("src/app/")) continue;
    const target = parse(readText(file) ?? "").target;
    if (target) targets.add(`${file.slice(0, file.lastIndexOf("/"))}/${target.screenDir}/${target.file.replace(/\.replace$/, "")}`);
  }
  const orphans = new Set(findOrphanReplaceFiles(files));
  /** @type {RouteReplaceProblem[]} */
  const problems = [];
  for (const file of findDotNamedFiles(files)) {
    const match = /^(.*)\/([^/]+)\.replace\.tsx?$/.exec(file);
    if (!match) continue;
    const [, dir, name] = match;
    if (dir.split("/").includes("_screen")) {
      problems.push({ path: file, reason: "in-screen" });
      continue;
    }
    if (orphans.has(file)) {
      problems.push({ path: file, reason: "orphan" });
      continue;
    }
    const hasDefault = [`${name}.default.tsx`, `${name}.default.ts`].some((rel) => present.has(`${dir}/${rel}`));
    if (!targets.has(`${dir}/${name}`) && !hasDefault) problems.push({ path: file, reason: "no-default" });
  }
  return problems.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** fork 所有のディレクトリ(下流の差し替え画面と page 専用部品)。upstream はここにファイルを置かない */
export const FORK_OWNED_DIR = "_components";

/**
 * findRouteReplaceProblems の 1 件を直し方つきの文にする(pnpm test scripts/structure/routes/screens.test.mjs と pnpm check extensions が同じ文を出す)
 * @param {RouteReplaceProblem} problem
 * @returns {string}
 */
export function describeRouteReplaceProblem({ path, reason }) {
  if (reason === "in-screen") {
    const segments = path.split("/");
    const route = segments.slice(0, segments.indexOf("_screen")).join("/");
    const name = segments[segments.length - 1].replace(/\.replace\.tsx?$/, "");
    const screen = name.endsWith("Screen") ? name : `${name}Screen`;
    return `${path}: _screen/ に fork の物は置かない(.replace も不可)。画面を丸ごと替えるなら ${route}/${FORK_OWNED_DIR}/${screen}.tsx に置いて ${route}/page.tsx の 1 行スイッチを ./${FORK_OWNED_DIR}/${screen} に向け、部品なら ${route}/${FORK_OWNED_DIR}/ に印なしの名前で置いて import を直す`;
  }
  if (reason === "orphan") return `${path}: 隣に置き換える既定が無い(孤立した .replace。既定の名前に合わせるか消す)`;
  return `${path}: 置き換えの口でない部品の .replace(置き換えられるのは page.tsx / layout.tsx の 1 行スイッチの向け先と <名前>.default の隣だけ)。fork の部品はルートの ${FORK_OWNED_DIR}/ に印なしの名前で置き、import を直す`;
}

/**
 * src/app 配下で FORK_OWNED_DIR のセグメントを持つファイルを返す。
 * `_` の意味は場所で違う: `_screen/`・`_layout/` = 提供者の既定、`_components/` = fork 所有。
 * upstream が `_components/` に置くと fork の置き場と衝突するので、pnpm test scripts/structure/routes/screens.test.mjs が Tier1 でだけ検査する
 * @param {string[]} files repo 相対パス
 */
export function findForkOwnedDirFiles(files) {
  return files.filter((file) => file.startsWith("src/app/") && file.split("/").slice(0, -1).includes(FORK_OWNED_DIR));
}

/** page.tsx に書ける設定 export の名前(値は page.tsx 自体に書く。Next が静的解析するため re-export 不可) */
const PAGE_CONFIG_EXPORTS = ["metadata", "viewport", "preferredRegion", "maxDuration"];

/**
 * cacheComponents と両立しない segment config の名(書かない)。切り替えの形の検査でも違反にする
 * (lint segment-config/cc-incompatible と同じ名。全 Tier error)
 */
const CC_INCOMPATIBLE_SEGMENT_CONFIG = ["dynamic", "dynamicParams", "fetchCache", "revalidate", "runtime"];

/**
 * cacheComponents と両立しない segment config の問題文
 * @param {string} name
 */
const ccIncompatibleProblem = (name) =>
  `segment config \`${name}\` は書かない(cacheComponents と両立しない。lint segment-config/cc-incompatible、消すだけでよい)`;

/**
 * Screen のファイルから default と一緒に re-export してよい名前(Next が実行時に読む値・関数)。
 * generateMetadata は必ず(createScreen が返す題名の関数。metadata を省いた画面は空を返す、D110)。静的な metadata は再 export しない
 */
export const REEXPORTABLE_FROM_SCREEN = ["generateMetadata", "viewport", "generateViewport"];

/** page.tsx の 1 行スイッチが必ず再 export する名前 */
export const REQUIRED_FROM_SCREEN = ["generateMetadata"];

/** 題名の止まる文(page.tsx・Screen の静的な metadata) */
const PAGE_TITLE_HINT = "題名は createScreen の metadata へ(値も関数 (data, props) も load = 範囲とページの確かめの後だけ返る)。page.tsx は `export { XScreen as default, generateMetadata } from \"./_screen/XScreen\"`";

/**
 * `start` 以降で最初に現れる open と対応する close の位置(括弧の釣り合い)を返す。
 * 文字列リテラル・テンプレートリテラル内の括弧は数えない。見つからなければ -1
 * @param {string} src
 * @param {number} start
 * @param {string} open
 * @param {string} close
 * @returns {number}
 */
export function findBalancedEnd(src, start, open, close) {
  let depth = 0;
  /** @type {string | null} */
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

/**
 * `export const metadata = {...};` などの設定 export を 1 つ取り除く(names = 取り除く名前、既定は書ける設定)
 * @param {string} src
 * @param {string[]} [names]
 * @returns {string | null} 取り除いた後の中身。無ければ null
 */
function stripConfigExport(src, names = PAGE_CONFIG_EXPORTS) {
  const re = new RegExp(`export\\s+(const|let)\\s+(${names.join("|")})\\b[^=]*=\\s*`);
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

/**
 * `export async function generateMetadata(...) {...}` / `generateViewport` を 1 つ取り除く
 * @param {string} src
 * @returns {string | null} 取り除いた後の中身。無ければ null
 */
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

/**
 * import 文を 1 つ取り除き、import 元を返す
 * @param {string} src
 * @returns {{ src: string, source: string } | null}
 */
function stripImport(src) {
  const m = /import\s+(type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']\s*;?/.exec(src);
  if (!m) return null;
  return { src: src.slice(0, m.index) + src.slice(m.index + m[0].length), source: m[2] };
}

/** ルート内 loader のファイル名(拡張子なし)。`<route>/_screen/loader.ts`(下流の差し替えなら `_components/loader.ts`) */
export const ROUTE_LOADER_FILE = "loader";

/**
 * page.tsx が許される import 元か。
 * 設定 export(viewport 等、layout は metadata / generateMetadata も)に必要なもの: next(型)、lib、config。
 * 画面ロジックに当たるもの(セクションコンテナ・hook・next/navigation 等)とルート内 loader は不可(題名は Screen の createScreen の metadata)
 * @param {string} source
 * @returns {boolean}
 */
function isAllowedImportSource(source) {
  if (source === "next") return true;
  if (/^@\/lib\//.test(source)) return true;
  if (/^@\/config\//.test(source)) return true;
  return false;
}

/** layout.tsx のスイッチ先のディレクトリ(既定の組み立て `_layout/<Name>Layout.tsx`、fork の丸ごと置き換えはその隣の <Name>Layout.replace.tsx) */
export const LAYOUT_DIRS = ["_layout"];

/** スイッチの種類ごとの文言(page と layout は同じ検査関数を共有する。報告書 §2「Screen と Layout は同じ概念の対」) */
const SWITCH_KINDS = {
  page: { file: "page.tsx", dirs: SCREEN_DIRS, target: "Screen", example: "XScreen", reexportable: REEXPORTABLE_FROM_SCREEN, required: REQUIRED_FROM_SCREEN, ownTitle: false },
  layout: { file: "layout.tsx", dirs: LAYOUT_DIRS, target: "組み立て", example: "XLayout", reexportable: ["metadata", ...REEXPORTABLE_FROM_SCREEN], required: [], ownTitle: true },
};

/**
 * page.tsx / layout.tsx を解析し、1 行スイッチ形かどうかと参照先を返す(共通の本体)。
 * 許されるもの: `./<dir>/<X>` からの re-export 1 つ(page = `export { <Name> as default, generateMetadata[, viewport] }`、
 * generateMetadata は必ず・metadata は不可 | layout = `export { <Name> as default[, metadata, generateMetadata] }`)、
 * 書ける設定 export(viewport / preferredRegion / maxDuration、layout は metadata・generateMetadata も)、それらに必要な import。
 * dynamic 等 cacheComponents と両立しない 5 つの名は違反。
 * @param {string} source ファイルの内容
 * @param {"page" | "layout"} kind
 * @returns {{ problems: string[], target: SwitchTarget | null }}
 *   problems が空ならスイッチ形。target は参照先(screenDir = 参照先のディレクトリ名、file = import パスの末尾、name = default に束ねた export 名)
 */
function parseSwitchModule(source, kind) {
  const { file: fileLabel, dirs, target: targetLabel, example, reexportable, required, ownTitle } = SWITCH_KINDS[kind];
  const dirLabel = dirs.map((dir) => `./${dir}/`).join(" または ");
  const problems = [];
  /** @type {SwitchTarget | null} */
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
      // 指す先は既定(印なし)か丸ごと置き換え <X>.replace だけ
      const kind = classifyDottedName(`${target.file.split("/").pop()}.tsx`).kind;
      if (kind !== "plain" && kind !== "replace") {
        problems.push(`指す先 ./${screenDir}/${target.file} は既定の <X> か丸ごと置き換えの <X>.replace だけ(旧い fork の印は共有の棚の印の移行の notice で改名する)`);
      }
    }
    for (const name of required) {
      if (!specifiers.includes(name)) problems.push(`re-export に \`${name}\` が無い(${PAGE_TITLE_HINT})`);
    }
    for (const spec of specifiers) {
      if (spec === defaultSpec) continue;
      if (reexportable.includes(spec)) continue;
      if (spec === "metadata" && !ownTitle) {
        problems.push(`静的な metadata は再 export しない(${PAGE_TITLE_HINT})`);
      } else if (spec === "default") {
        problems.push(`${targetLabel} は default export しない。\`export { ${example} as default } from ...\` の形で束ねる`);
      } else if (CC_INCOMPATIBLE_SEGMENT_CONFIG.includes(spec)) {
        problems.push(ccIncompatibleProblem(spec));
      } else if (PAGE_CONFIG_EXPORTS.includes(spec)) {
        problems.push(`\`${spec}\` は ${targetLabel} から re-export できない(Next が静的解析するため ${fileLabel} 自体に書く)`);
      } else {
        problems.push(`${targetLabel} から re-export できる名前は default と ${reexportable.join(" / ")} だけ(${spec})`);
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

  // 3. cacheComponents と両立しない segment config は違反として取り除く(残りの検査で二重に出さない)
  const ccNames = new RegExp(`export\\s+(?:const|let)\\s+(${CC_INCOMPATIBLE_SEGMENT_CONFIG.join("|")})\\b`, "g");
  for (const [, name] of src.matchAll(ccNames)) problems.push(ccIncompatibleProblem(name));
  for (let next = stripConfigExport(src, CC_INCOMPATIBLE_SEGMENT_CONFIG); next !== null; next = stripConfigExport(src, CC_INCOMPATIBLE_SEGMENT_CONFIG)) src = next;

  // 4. page.tsx は題名を自分で出さない(Screen の generateMetadata を再 export する)。layout は書ける(守りの範囲は guardMetadata、layoutGuardsMetadata)
  if (!ownTitle) {
    if (/export\s+(?:const|let)\s+metadata\b/.test(src)) problems.push(`${fileLabel} に静的な metadata を書かない(${PAGE_TITLE_HINT})`);
    if (/export\s+(?:async\s+)?function\s+generateMetadata\b|export\s+const\s+generateMetadata\b/.test(src)) {
      problems.push(`${fileLabel} に generateMetadata を書かない(${PAGE_TITLE_HINT})`);
    }
  }
  // 書ける設定 export と generateMetadata は取り除く(中身は検査しない)
  for (let next = stripConfigExport(src); next !== null; next = stripConfigExport(src)) src = next;
  for (let next = stripGenerateMetadata(src); next !== null; next = stripGenerateMetadata(src)) src = next;

  // 5. 残りは空でなければならない
  const remainder = src.replace(/;/g, "").trim();
  if (remainder) {
    problems.push(`許可されない記述が残っている: ${remainder.split("\n")[0].trim()}`);
  }
  return { problems, target };
}

/**
 * page.tsx を解析し、スイッチ形かどうかと参照先を返す。
 * 許されるもの: `./_screen/<X>` または `./_components/<X>` からの `export { <Name> as default, generateMetadata }` 1 つ
 * (generateMetadata は必ず。静的な metadata・自前の generateMetadata は不可 = 題名は createScreen の metadata、D110)、
 * 書ける設定 export(viewport / preferredRegion / maxDuration)、それらに必要な import
 * (dynamic 等 cacheComponents と両立しない 5 つの名は違反)。
 * @param {string} source page.tsx の内容
 * @returns {{ problems: string[], target: SwitchTarget | null }}
 *   problems が空ならスイッチ形。target は参照先(screenDir = "_screen" | "_components"、file = import パスの末尾、name = default に束ねた export 名)
 */
export function parseSwitchPage(source) {
  return parseSwitchModule(source, "page");
}

/**
 * 枠を描く layout.tsx を解析し、1 行スイッチ形かどうかと参照先を返す(page.tsx と同じ検査。参照先は `./_layout/<X>`)。
 * 例: `export { UserLayout as default } from "./_layout/UserLayout";`
 * @param {string} source layout.tsx の内容
 * @returns {{ problems: string[], target: SwitchTarget | null }} screenDir は常に "_layout"
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

/** 画面の作り手の設定済み版の import 元(src/wiring/screen.tsx、D110) */
export const SCREEN_MAKER_IMPORT = "@/wiring/screen";

/** Screen の形の直し方(止まる文に添える 1 行) */
const SCREEN_FORM_HINT = `\`export const { Screen: XScreen, generateMetadata } = createScreen({ load: loadXScreen, render: (data, props) => …, metadata? })\`(createScreen は ${SCREEN_MAKER_IMPORT} から)`;

/**
 * Screen のファイルの作り手の呼び出しを読む: `export const { Screen: <name>, generateMetadata } = createScreen({ … })` の
 * 設定のオブジェクトの最上位の字面(入れ子の括弧の中身と文字列を空けた物)。読めなければ problems に理由
 * @param {string} src コメントを除いた Screen のファイル
 * @param {string} name Screen の名前(named export)
 * @returns {{ problems: string[], top: string | null }}
 */
function readScreenMaker(src, name) {
  const problems = [];
  const imported = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  const makerImported = [...src.matchAll(imported)].some(
    (m) => m[2] === SCREEN_MAKER_IMPORT && m[1].split(",").some((s) => s.trim() === "createScreen"),
  );
  if (!makerImported) problems.push(`createScreen を ${SCREEN_MAKER_IMPORT} から import していない(${SCREEN_FORM_HINT})`);
  const calls = [...src.matchAll(/export\s+const\s*\{([^}]*)\}\s*=\s*createScreen\s*\(\s*\{/g)];
  if (calls.length !== 1) {
    problems.push(`${name} が createScreen の呼び出しの export でない(${SCREEN_FORM_HINT})`);
    return { problems, top: null };
  }
  const specs = calls[0][1].split(",").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (specs.length !== 2 || specs[0] !== `Screen: ${name}` || specs[1] !== "generateMetadata") {
    problems.push(`createScreen の戻り値の受け方は \`{ Screen: ${name}, generateMetadata }\` だけ(${specs.join(", ")})`);
  }
  const open = calls[0].index + calls[0][0].length - 1;
  const close = findBalancedEnd(src, open, "{", "}");
  if (close < 0) {
    problems.push(`${name} の createScreen の設定のオブジェクトが読めない`);
    return { problems, top: null };
  }
  let depth = 0;
  let top = "";
  /** @type {string | null} */
  let quote = null;
  for (let i = open + 1; i < close; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      if (depth === 0) top += " ";
      continue;
    }
    if ("({[".includes(ch)) {
      if (depth === 0) top += " ";
      depth += 1;
      continue;
    }
    if (")}]".includes(ch)) {
      depth -= 1;
      continue;
    }
    if (depth === 0) top += ch;
  }
  return { problems, top };
}

/**
 * Screen のファイルの検査(D110)。問題があれば理由の配列を返す。
 * - `createScreen` を `@/wiring/screen` から import し、`export const { Screen: <name>, generateMetadata } = createScreen({ … })` を 1 つ持つ
 * - Screen を関数で書かない・静的な `metadata` や自前の `generateMetadata` を出さない(題名は createScreen の metadata、load の後だけ)
 * - default export しない(page.tsx が as default で再 export する)
 * - `"use client"` を持たない(Screen は Server Component。hook を使う部分はセクションコンテナへ下ろす)
 * load が同じルートの loader かは checkScreenLoaderCall が見る
 * @param {string} source Screen ファイルの内容
 * @param {string} name 期待する named export 名
 */
export function checkScreenFile(source, name) {
  const src = stripComments(source);
  const { problems } = readScreenMaker(src, name);
  if (new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b`).test(src)) {
    problems.push(`${name} を関数で書かない(本文は load の後だけ: ${SCREEN_FORM_HINT})`);
  }
  if (/export\s+(const|let)\s+metadata\b/.test(src) || /export\s+(async\s+)?function\s+generateMetadata\b/.test(src)) {
    problems.push("Screen は静的な metadata・自前の generateMetadata を出さない(題名は createScreen の metadata へ。値も関数 (data, props) も load の後だけ返る)");
  }
  if (/export\s+default/.test(src)) {
    problems.push("default export しない(page.tsx が as default で再 export する)");
  }
  if (/^\s*["']use client["']/m.test(src)) {
    problems.push('"use client" を持つ(Screen は Server Component。hook を使う部分はセクションコンテナへ下ろす)');
  }
  return problems;
}

/** 管理のページ(src/app/admin の下)の枠の行を描く部品 */
export const ADMIN_PAGE_COMPONENT = "AdminPage";
const ADMIN_PAGE_IMPORT = /import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']((?:@\/app\/admin|\.{1,2}(?:\/\.\.)*)\/_layout\/AdminPage)["']/g;

/**
 * 管理のページの Screen の検査(全 Tier、例外なし)。管理のヘッダーの行は AdminPage が描くので、AdminPage を描かないページには
 * ヘッダーが出ない(D134)。Screen のファイル自身が AdminPage を import して `<AdminPage …>` を描くことを字面で読む。
 * 限界: 子の部品の中で AdminPage を描く形(Screen が `<MyShell>` を返し、その中で AdminPage)は読まずに止める
 * (ページがヘッダーの行を描く決定のとおり、Screen が AdminPage を描き、子はその中に置く)
 * @param {string} source Screen ファイルの内容
 * @returns {string[]} 問題(空なら合格)
 */
export function checkAdminPageScreen(source) {
  const src = stripComments(source);
  const locals = new Set();
  for (const m of src.matchAll(ADMIN_PAGE_IMPORT)) {
    if (m[1]) locals.add(m[1]);
    for (const spec of (m[2] ?? "").split(",")) {
      const named = /^\s*(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?\s*$/.exec(spec);
      if (named && named[1] === ADMIN_PAGE_COMPONENT) locals.add(named[2] ?? named[1]);
    }
  }
  const renders = [...locals].some((local) => new RegExp(`<${local}[\\s>/]`).test(src));
  if (renders) return [];
  return [
    `管理のページの Screen が <${ADMIN_PAGE_COMPONENT}> を描いていない(管理のヘッダーの行は AdminPage が描く。題・中央・右の操作は <${ADMIN_PAGE_COMPONENT} title="…" center={…} actions={…}> で渡し、子の部品は AdminPage の中に置く。ヘッダーを出さないページも AdminPage で包み、隣の frame.ts の宣言 { page: { hide: { header: { sp: true, pc: true } } } } で隠す)`,
  ];
}

/**
 * Screen は `@/domains/<domain>/components/` 配下のセクションコンテナを読み、その内側(部品、契約外)を直接読まない(must-read §4)。
 * 「部品を持つコンテナ」= `index.tsx` を持つディレクトリ。import 先の途中のディレクトリがコンテナなら違反。
 * コンテナでないディレクトリ(`Admin/` `common/` などのグループ分け、`index.ts` だけの barrel)は名前空間として通す。
 * `<Name>/index` は `<Name>` と同じ扱い。features 以外(components/ lib/ など)と相対 import は対象外
 * @param {string} source
 * @param {{ isContainerDir?: (dirSpec: string) => boolean }} [options]
 *   isContainerDir: `@/domains/.../components/<a>`(import 指定子の形、末尾 / 無し)がコンテナか。
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
    const path = /^(@\/domains\/(?:core\/)?[^/]+\/components)\/(.+)$/.exec(spec);
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
 * @param {string} source Screen ファイルの内容
 * @param {string} name Screen の名前(named export)
 * @returns {string | null}
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
 * @param {string} source
 * @returns {boolean}
 */
export function isReexportOnlyFile(source) {
  const src = stripComments(source);
  if (!/\bexport\b/.test(src)) return false;
  const rest = src.replace(/export\s+(type\s+)?(\*(\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["'][^"']+["']\s*;?/g, "");
  return !/\bexport\b/.test(rest);
}

/**
 * 相対 import(`./x` / `../x`)を from ファイルの位置から解決する(node:path に依存しない。`/` 区切り、`\` は `/` に正規化)
 * @param {string} fromFile repo 相対パス
 * @param {string} source 相対の import 元
 * @returns {string}
 */
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
 * Screen 名の判定は相対 import か `_screen/` / `_components/` 配下に限る(`domains/<domain>/types/XScreen` のような型ファイルを誤検出しない)
 * @param {string} source import 元
 * @param {string} loaderPath loader の repo 相対パス(空なら相対 import を解決しない)
 * @returns {boolean}
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
 * - shell: true の宣言は checkShellDeclaration が見る(DB・保管庫・request を読まない load だけ)
 * - 主体は guard.ts の createLoader が load の文脈の getUser() で渡す(セッション API の import は lint page-authz/session-api-callsite が止める。
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
  problems.push(...checkShellDeclaration(src));
  return problems;
}

/** shell: true の loader が読んではいけない物(DB・保管庫・request)の import 元 */
const SHELL_FORBIDDEN_IMPORTS = [/\/services\/server(\/|$)/, /^@\/lib\/storage(\/|$)/, /^@\/lib\/drizzle(\/|$)/, /\/entities\/drizzle$/, /^next\/headers$/];

/**
 * `shell: true`(load が DB・保管庫・request を読まない宣言、lib/pageGuard)の可否を字面で見る。宣言した loader が
 * (a) DB・保管庫・request の部品を import している (b) key を持つ(params・searchParams = request)(c) load で getUser・allows を使う、なら問題。
 * 範囲が遅らせる鎖か(public で setup 誘導なし)は build:post の殻の検査が route-map の鎖で見る
 * @param {string} src コメントを除いた loader の文
 * @returns {string[]}
 */
export function checkShellDeclaration(src) {
  if (!/\bshell\s*:\s*true\b/.test(src)) return [];
  const problems = [];
  for (const m of src.matchAll(/\bimport\s+(?!type\b)[^"'`;]*?\bfrom\s*["']([^"']+)["']/g)) {
    if (SHELL_FORBIDDEN_IMPORTS.some((re) => re.test(m[1]))) problems.push(`shell: true なのに ${m[1]} を import している(DB・保管庫・request を読む load は宣言しない: 既定の request 時に戻す)`);
  }
  if (/\bkey\s*:/.test(src)) problems.push("shell: true なのに key がある(params・searchParams は request。宣言を外す)");
  if (/\b(getUser|allows)\b/.test(src)) problems.push("shell: true なのに load が getUser・allows を使う(利用者は request。宣言を外す)");
  return problems;
}

// ---------------------------------------------------------------------------
// 守りの鎖の解析(ルート地図の verified と pnpm test scripts/structure/routes/screens.test.mjs の D21 が共有する。字面だけを読む)
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
  const expr = (/** @type {number} */ start) => {
    // 値の終わり(同じ深さの , } ])まで読み、字面のまま返す
    let depth = 0;
    /** @type {string | null} */
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
  /** @returns {unknown} */
  const value = () => {
    ws();
    const start = i;
    const ch = src[i];
    if (ch === "{") {
      i += 1;
      /** @type {Record<string, unknown>} */
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

/**
 * parseLiteral の結果に字面で読めない値(`{ expr }`)が含まれるか
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasExpression(value) {
  if (value && typeof value === "object") {
    if (isRecord(value) && Object.keys(value).length === 1 && typeof value.expr === "string") return true;
    return Object.values(value).some(hasExpression);
  }
  return false;
}

/**
 * `name(` の直後の最初の引数の字面(括弧の釣り合いで切る)。見つからなければ null
 * @param {string} src
 * @param {string} name
 * @returns {{ text: string, value: unknown } | null}
 */
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

/**
 * 名前付き import の import 元(`import { a, b as c } from "x"` の a / c)を探す。無ければ null
 * @param {string} src
 * @param {string} localName
 * @returns {{ source: string, imported: string } | null} imported = import 元での名前
 */
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

/**
 * import 元(`@/...` / 相対)を repo 相対のファイルに解決する(fileSet で .ts / .tsx / index を探す)。見つからなければ null
 * @param {string} fromFile import するファイル(repo 相対)
 * @param {string} source import 元
 * @param {Set<string>} fileSet repo 相対のファイルの集合
 * @returns {string | null}
 */
export function resolveImportFile(fromFile, source, fileSet) {
  let base;
  if (source.startsWith("@/")) base = `src/${source.slice(2)}`;
  else if (/^\.\.?\//.test(source)) base = resolveRelative(fromFile, source);
  else return null;
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base].find((c) => fileSet.has(c)) ?? null;
}

/**
 * 管理画面の共通部品の組(src/domains/core/admin/services/server/screenParts.ts)と、それぞれが serviceRegistry から解く操作
 * @type {Readonly<Record<string, string>>}
 */
export const ADMIN_PARTS_OPERATIONS = {
  adminListParts: "search",
  adminEditParts: "get",
  adminCreateParts: "create",
  adminSortParts: "searchForSorting",
};

/**
 * D21・D110: Screen の createScreen の load が同じルートの loader か。loader の名前は設定の最上位の `load: <名前>` の字面から取る
 * (Screen は load の後にだけ本文を描く。作り手の形の他の問題は checkScreenFile が見る)
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
  if (!imp || loaderNames.length === 0) return { problems: ["同じルートの loader(./loader の load<Name>)を import していない"], loaderName: null, loaderImport: null };
  const { top } = readScreenMaker(src, name);
  if (top === null) return { problems: [`${name} の createScreen の呼び出しが読めない(${SCREEN_FORM_HINT})`], loaderName: null, loaderImport: imp[2] };
  const load = /(?:^|,)\s*load\s*:\s*([A-Za-z_$][\w$]*)\s*(?=,|$)/.exec(top.trim());
  if (!load) {
    return { problems: [`${name} の createScreen に \`load: ${loaderNames[0]}\` が無い(同じルートの loader をそのまま渡す。包む関数・式は不可)`], loaderName: null, loaderImport: imp[2] };
  }
  if (!loaderNames.includes(load[1])) {
    return { problems: [`${name} の createScreen の load(${load[1]})が同じルートの loader(${loaderNames.join(" / ")})でない`], loaderName: null, loaderImport: imp[2] };
  }
  return { problems: [], loaderName: load[1], loaderImport: imp[2] };
}

const PARTS_CALL_HEAD = /^(admin(?:List|Edit|Create|Sort)Parts)\s*(?:<[^()]*>)?\(\s*["']([\w]+)["']/;

/**
 * `text` の先頭が `adminXxxParts("<domain>"…)` の呼び出しなら、組の名前・domain・閉じ括弧の位置。読めなければ null
 * @param {string} text
 * @returns {{ partsName: string, domain: string, end: number } | null}
 */
function partsCallAt(text) {
  const m = PARTS_CALL_HEAD.exec(text);
  if (!m) return null;
  const end = findBalancedEnd(text, m[0].indexOf("("), "(", ")");
  if (end < 0) return null;
  return { partsName: m[1], domain: m[2], end };
}

const escapeRegExp = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * createLoader({ access: <式> }) の式が管理画面の共通部品の組の access か。組の access = domainAccess(domain, 操作) なので、
 * 引数まるごとの形(createLoader(adminListParts("d")))と同じ registry:<domain>.<operation> に読める。
 * 受け付ける形: `adminXxxParts("d"…).access` / 同じファイルで 1 回だけ `const x = adminXxxParts("d"…)` と束ねた `x.access`
 * (組の関数は `@/domains/core/admin/services/server/screenParts` から import、domain は文字列の字面)。
 * それ以外(分割代入・別ファイルの組・let / var・名前の再宣言や再代入・`.access` の先まで辿る式)は null(字面で読めない扱い)。
 * @param {string} src loader の内容(コメントを除いた物)
 * @param {string} expr access の式の字面
 * @returns {{ partsName: string, domain: string } | null}
 */
function partsAccessOf(src, expr) {
  const text = expr.trim();
  const inline = partsCallAt(text);
  if (inline) {
    return /^\s*\.\s*access$/.test(text.slice(inline.end + 1)) ? { partsName: inline.partsName, domain: inline.domain } : null;
  }
  const ref = /^([A-Za-z_$][\w$]*)\s*\.\s*access$/.exec(text);
  if (!ref) return null;
  const name = escapeRegExp(ref[1]);
  // 宣言は const の 1 回だけ(再宣言・内側での影・再代入・import が無い)
  if (new RegExp(`\\b(?:let|var|function|class)\\s+${name}\\b`).test(src)) return null;
  if (namedImportSource(src, ref[1]) || new RegExp(`import\\s+${name}\\b`).test(src)) return null;
  const assigns = [...src.matchAll(new RegExp(`(?<![\\w$.])${name}\\s*(?::[^=;]+)?=(?![=>])`, "g"))];
  if (assigns.length !== 1) return null;
  const decl = new RegExp(`\\bconst\\s+${name}\\s*(?::[^=;]+)?=\\s*`).exec(src);
  // 唯一の代入がこの const の宣言であること
  if (!decl || assigns[0].index < decl.index || assigns[0].index >= decl.index + decl[0].length) return null;
  const rest = src.slice(decl.index + decl[0].length);
  const call = partsCallAt(rest);
  if (!call || !/^\s*(?:;|\n|$)/.test(rest.slice(call.end + 1))) return null;
  return { partsName: call.partsName, domain: call.domain };
}

/**
 * loader の createLoader の import 元と access を読む。
 * access はオブジェクトの access の字面、または管理画面の共通部品の組(registry:<domain>.<operation>)。
 * 組は引数まるごと(createLoader(adminListParts("d")))か、access: <組>.access(partsAccessOf の形)。
 * @param {string} source loader の内容
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
    if (!parts || parts.source !== "@/domains/core/admin/services/server/screenParts") {
      return { problems: [`${partsCall[1]} を @/domains/core/admin/services/server/screenParts から import していない`], guardImport: imp.source, access: null, allowStatuses: null };
    }
    return {
      problems: [],
      guardImport: imp.source,
      access: { registry: `${partsCall[2]}.${ADMIN_PARTS_OPERATIONS[partsCall[1]]}` },
      allowStatuses: null,
    };
  }
  const config = arg.value;
  if (!isRecord(config) || "expr" in config) {
    return { problems: ["createLoader の引数が字面のオブジェクトでない({ access, … } か管理画面の組 admin*Parts(…))"], guardImport: imp.source, access: null, allowStatuses: null };
  }
  if (!("access" in config)) return { problems: ["createLoader に access が無い"], guardImport: imp.source, access: null, allowStatuses: null };
  const partsAccess =
    isRecord(config.access) && typeof config.access.expr === "string" && Object.keys(config.access).length === 1
      ? partsAccessOf(src, config.access.expr)
      : null;
  if (partsAccess) {
    const parts = namedImportSource(src, partsAccess.partsName);
    if (!parts || parts.source !== "@/domains/core/admin/services/server/screenParts" || parts.imported !== partsAccess.partsName) {
      return { problems: [`${partsAccess.partsName} を @/domains/core/admin/services/server/screenParts から import していない`], guardImport: imp.source, access: null, allowStatuses: null };
    }
    return {
      problems: [],
      guardImport: imp.source,
      access: { registry: `${partsAccess.domain}.${ADMIN_PARTS_OPERATIONS[partsAccess.partsName]}` },
      allowStatuses: config.allowStatuses ?? null,
    };
  }
  if (hasExpression(config.access)) {
    return { problems: [`access が字面で読めない(${JSON.stringify(config.access)})`], guardImport: imp.source, access: null, allowStatuses: null };
  }
  return { problems: [], guardImport: imp.source, access: config.access, allowStatuses: config.allowStatuses ?? null };
}

/** guard.ts の方針として地図に載せるキー(この順で出す) */
export const GUARD_POLICY_KEYS = ["access", "allowStatuses", "redirectTo", "forbiddenRedirectTo", "returnBack", "statusRedirects", "setupRedirectTo"];

/**
 * guard.ts を読む: root(@/wiring/pageGuard の defineRootGuard)か、親の extend を import して呼ぶ子か。
 * @param {string} source guard.ts の内容
 * @returns {{ problems: string[], root: boolean, parentImport: string | null, policy: Record<string, unknown> | null }}
 */
export function parseGuardFile(source) {
  const src = stripComments(source);
  const exportsAll = /export\s+const\s*\{\s*Guard\s*,\s*createLoader\s*,\s*guardMetadata\s*,\s*extend\s*\}\s*=/.test(src);
  const problems = exportsAll ? [] : ["guard.ts は `export const { Guard, createLoader, guardMetadata, extend } = …` の形にする"];
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
  if (!isRecord(policy) || "expr" in policy) {
    return { problems: [...problems, `${callee}(…) の方針が字面のオブジェクトでない`], root: Boolean(root), parentImport, policy: null };
  }
  if (hasExpression(policy)) problems.push(`方針に字面で読めない値がある(${JSON.stringify(policy)})`);
  /** @type {Record<string, unknown>} */
  const ordered = {};
  for (const key of GUARD_POLICY_KEYS) if (key in policy) ordered[key] = policy[key];
  for (const key of Object.keys(policy)) if (!GUARD_POLICY_KEYS.includes(key)) problems.push(`方針の未知のキー ${key}`);
  return { problems, root: Boolean(root), parentImport, policy: ordered };
}

/**
 * layout(か 1 行スイッチ先)が範囲の守りの境界 `<Guard fallback={…}>` を描いているか(`./guard` から import)。
 * 守りは layout の頭で待たず境界の内側で確かめる(D76)
 * @param {string} source
 * @returns {boolean}
 */
export function layoutRendersGuard(source) {
  const src = stripComments(source);
  const imp = namedImportSource(src, "Guard");
  return Boolean(imp && imp.source === "./guard" && /<Guard\b[^>]*\bfallback\s*=/.test(src));
}

/**
 * layout(か 1 行スイッチ先)が範囲の守りを layout の頭で待っているか(`await guard()`)。境界の外で要求を待つので止める(D76)
 * @param {string} source
 * @returns {boolean}
 */
export function layoutAwaitsGuard(source) {
  return /\bawait\s+guard\s*\(\s*\)/.test(stripComments(source));
}

/**
 * layout が metadata を守りの後で出すか: `./guard` の guardMetadata で `export const generateMetadata = guardMetadata(…)` を書き、
 * 静的な `export const metadata` を持たない(断られた訪問者の応答に配下のページの題名を出さないため。Next は根からページへ順に解く)
 * @param {string} source
 * @returns {boolean}
 */
export function layoutGuardsMetadata(source) {
  const src = stripComments(source);
  const imp = namedImportSource(src, "guardMetadata");
  const exported = /export\s+const\s+generateMetadata\s*=\s*guardMetadata\s*\(/.test(src);
  const staticMetadata = /export\s+const\s+metadata\b/.test(src);
  return Boolean(imp && imp.source === "./guard" && exported && !staticMetadata);
}

/**
 * 2 つのページの間の client の遷移に共有される段(フォルダ)を求める: その段のページ + 下のページ、または別々の子の段の下の
 * ページ 2 つ以上を持つ段。共有される段は遷移で再描画されないので、下のページの loader が要求を待つ境界は
 * その段の loading.tsx が要る(D76。Next の instant の検証は境界の外で待つ遷移を知らせる)
 * @param {string[]} pageDirs ページのフォルダ(repo 相対、`_` のフォルダを除いた木。routeTree の route.dir)
 * @returns {string[]} 共有される段のフォルダ(並びは名前順)
 */
export function sharedNavigationSegments(pageDirs) {
  const pages = new Set(pageDirs);
  /** @type {Map<string, Set<string>>} */
  const childrenWithPages = new Map();
  for (const dir of pages) {
    const parts = dir.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      const ancestor = parts.slice(0, i).join("/");
      const child = parts[i];
      if (!childrenWithPages.has(ancestor)) childrenWithPages.set(ancestor, new Set());
      childrenWithPages.get(ancestor)?.add(child);
    }
  }
  const shared = [];
  for (const [dir, children] of childrenWithPages) {
    if ((pages.has(dir) ? 1 : 0) + children.size >= 2) shared.push(dir);
  }
  return shared.sort();
}
