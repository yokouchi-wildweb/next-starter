// scripts/structure/next-config/lib.mjs
// next の設定の検査の判定(純関数)。入口は check.ts、説明は README.md。
// 各リポの素の next.config.ts(型 5 self)を解いた最後の設定に、上流の約束が残っているかを見る(eslint の requiredRules と同じ作り、D300)。

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * next.config の default export を Next と同じ手順で解く: 関数なら (phase, { defaultConfig }) で呼んで待つ
 * @param {unknown} exported 素の next.config.ts の default export
 * @param {{ phase: string, defaultConfig: Record<string, unknown> }} context
 * @returns {Promise<Record<string, unknown>>}
 */
export async function resolveConfig(exported, { phase, defaultConfig }) {
  const value = typeof exported === "function" ? await exported(phase, { defaultConfig }) : await exported;
  return /** @type {Record<string, unknown>} */ (value ?? {});
}

/** rewrites() の結果(配列か beforeFiles / afterFiles / fallback の組)を 1 本の並びにする */
function flattenRewrites(/** @type {unknown} */ rewrites) {
  if (Array.isArray(rewrites)) return rewrites;
  if (rewrites && typeof rewrites === "object") {
    const groups = /** @type {Record<string, unknown>} */ (rewrites);
    return ["beforeFiles", "afterFiles", "fallback"].flatMap((key) => (Array.isArray(groups[key]) ? groups[key] : []));
  }
  return [];
}

const FIREBASE_AUTH_SOURCE = "/__/:path*";
const FIREBASE_AUTH_DESTINATION = /^https:\/\/[^/]+\.web\.app\/__\/:path\*$/;

/** 許可の 1 本の同じ(protocol・hostname・port・pathname・search) */
const samePattern = (/** @type {Record<string, unknown>} */ a, /** @type {Record<string, unknown>} */ b) =>
  ["protocol", "hostname", "port", "pathname", "search"].every((key) => (a[key] ?? "") === (b[key] ?? ""));

/**
 * ホスト全体を許していないか: hostname に * が無く、pathname の最初の段が固定(無い・/** だけ・/* で始まるのは全体)
 * @param {Record<string, unknown> | URL} pattern
 */
function isNarrow(pattern) {
  const hostname = String(pattern.hostname ?? "");
  const pathname = String(pattern.pathname ?? "");
  if (hostname === "" || hostname.includes("*")) return false;
  const first = pathname.split("/")[1] ?? "";
  return pathname.startsWith("/") && first !== "" && !first.includes("*");
}

/**
 * 解いた設定の約束を見る(1 つの約束に 1 行)
 * @param {Record<string, any>} config 解いた最後の設定
 * @param {{ tier1: boolean, appEnv: string, corePatterns: Record<string, unknown>[], rewrites?: unknown, buildId?: unknown }} expected
 *   tier1 = readForkIdentity の isTier1、appEnv = getAppEnv()、corePatterns = 本体の imageRemotePatterns(同じ env で計算した上流の置き場)、
 *   rewrites = await config.rewrites()、buildId = await config.generateBuildId()(呼び出しは check.ts。関数でなければ undefined)
 * @returns {string[]} problems
 */
export function checkConfig(config, expected) {
  const problems = [];
  const env = config?.env ?? {};
  if (env.FEATURE_GATE_TIER1 !== String(expected.tier1)) {
    problems.push(`env.FEATURE_GATE_TIER1 が ${JSON.stringify(env.FEATURE_GATE_TIER1)}(${String(expected.tier1)} であること。本体の featureGateTier1 = repo.json の名前から。読み手 src/featureGate/openSwitch.ts)`);
  }
  if (env.APP_ENV !== expected.appEnv) {
    problems.push(`env.APP_ENV が ${JSON.stringify(env.APP_ENV)}(getAppEnv() の ${JSON.stringify(expected.appEnv)} であること。client の段階の答え、@/lib/appEnv)`);
  }
  if (typeof config?.generateBuildId !== "function") {
    problems.push("generateBuildId が無い(ビルドごとの番号。本体のまま残す)");
  } else if (typeof env.NEXT_BUILD_ID !== "string" || expected.buildId !== env.NEXT_BUILD_ID) {
    problems.push(`generateBuildId の答え(${JSON.stringify(expected.buildId)})が env.NEXT_BUILD_ID(${JSON.stringify(env.NEXT_BUILD_ID)})と違う(読み手 /api/health のデプロイの検知)`);
  }
  const patterns = Array.isArray(config?.images?.remotePatterns) ? config.images.remotePatterns : [];
  for (const core of expected.corePatterns) {
    if (!patterns.some((pattern) => typeof pattern === "object" && samePattern(pattern, core))) {
      problems.push(`images.remotePatterns に上流の置き場が無い(${core.hostname}${core.pathname ?? ""})。本体の imageRemotePatterns を残して足す`);
    }
  }
  for (const pattern of patterns) {
    const value = pattern instanceof URL ? pattern : /** @type {Record<string, unknown>} */ (pattern);
    if (!isNarrow(value)) {
      problems.push(`images.remotePatterns がホスト全体を許している(${String(value.hostname ?? "")}${String(value.pathname ?? "")})。自分の置き場のパスに絞る(ホスト全体は画像最適化の課金枠の踏み台になる)`);
    }
  }
  const rewrites = flattenRewrites(expected.rewrites);
  if (!rewrites.some((rule) => rule?.source === FIREBASE_AUTH_SOURCE && FIREBASE_AUTH_DESTINATION.test(String(rule?.destination ?? "")))) {
    problems.push(`rewrites に Firebase の認証の転送(${FIREBASE_AUTH_SOURCE} → https://<project>.web.app/__/:path*)が無い(本体の rewrites を残して足す)`);
  }
  if (config?.cacheComponents !== true) {
    problems.push(
      `next.config の cacheComponents が true でない(${JSON.stringify(config?.cacheComponents)})。false に戻さない(fork ごとのスイッチは無い。直すべき所は build の失敗が名指す)`,
    );
  }
  if (config?.partialPrefetching !== true) {
    problems.push(
      `next.config の partialPrefetching が true でない(${JSON.stringify(config?.partialPrefetching)})。全体で true のまま(fork ごとのスイッチ・セグメントごとの prefetch = 'partial' は使わない。Next の次の大きな版で唯一の動きになる)`,
    );
  }
  return problems;
}

/** 静的に焼き付いた API の route か(prerender-manifest の routes のキー) */
const isApiRoute = (/** @type {string} */ route) => route === "/api" || route.startsWith("/api/");

/**
 * build の成果物を見る: cacheComponents が true で build された・/api の下に静的に焼き付いた route が無い
 * @param {string} distDir .next
 * @returns {{ problems: string[], staticRoutes: number } | null} 成果物が無ければ null(未検証)
 */
export function checkBuild(distDir) {
  const requiredPath = join(distDir, "required-server-files.json");
  const prerenderPath = join(distDir, "prerender-manifest.json");
  if (!existsSync(requiredPath) || !existsSync(prerenderPath)) return null;
  const problems = [];
  const required = JSON.parse(readFileSync(requiredPath, "utf8"));
  if (required?.config?.cacheComponents !== true) {
    problems.push(`build は cacheComponents=${JSON.stringify(required?.config?.cacheComponents)} で作られた(true のまま build する)`);
  }
  const prerender = JSON.parse(readFileSync(prerenderPath, "utf8"));
  const routes = Object.keys(prerender?.routes ?? {});
  const staticApi = routes.filter(isApiRoute).sort();
  for (const route of staticApi) {
    problems.push(
      `${route}: API の route が build で静的に焼き付いた(○)。route.ts は wiring の Factory(createApiRoute 等)で書く(最初に connection() を待つ)`,
    );
  }
  return { problems, staticRoutes: routes.length };
}

/**
 * 殻に入れない範囲(D50: 管理・ログイン必須・debug)のページか。
 * 鎖に public でない guard がある(保護の範囲)か、ページが管理の枠(src/app/admin/ の下。/admin/login・/admin/setup も)にある
 * @param {{ chain?: Array<{ kind: string, file?: string, policy?: { access?: unknown } }> }} row route-map.jsonl の 1 行
 * @returns {boolean}
 */
export function isHoleRange(row) {
  const chain = row?.chain ?? [];
  if (chain.some((link) => link.kind === "guard" && link.policy?.access !== "public")) return true;
  const page = chain.find((link) => link.kind === "page");
  return typeof page?.file === "string" && page.file.startsWith("src/app/admin/");
}

/**
 * 素の build(adapter なし)の殻の HTML の道(.next/server/app/<path>.html、/ は index.html、[param] は名前のまま)
 * @param {string} distDir
 * @param {string} path route-map の path
 */
export function shellPath(distDir, path) {
  return join(distDir, "server", "app", `${path === "/" ? "/index" : path}.html`);
}

/** adapter の build(Vercel は env NEXT_ADAPTER_PATH で挿す)が殻を置く木: <distDir>/server/route-cache/APP_PAGE/<鍵>/$/<path>.html */
const ROUTE_CACHE_APP_PAGE = ["server", "route-cache", "APP_PAGE"];

/**
 * build が置いた殻の HTML を path ごとに引く(path → ファイル)。置き場は build の形で 2 つ:
 * - 素の build: <distDir>/server/app/<path>.html(shellPath)
 * - adapter の build(Vercel): <distDir>/server/route-cache/APP_PAGE/<鍵>/$/<path>.html(Next 16.4.6 の
 *   build/adapter/build-complete.js getPrerenderFilePath。onBuildComplete の outputs.prerenders[].fallback.filePath と同じ物)
 * どちらも / は index.html、[param] は名前のまま。両方にあれば素の build の物
 * @param {string} distDir
 * @returns {Map<string, string>}
 */
export function locateShells(distDir) {
  const shells = new Map();
  const toPath = (rel) => {
    const name = rel.split(/[\\/]/).join("/").replace(/\.html$/, "");
    return name === "index" ? "/" : `/${name}`;
  };
  const cacheDir = join(distDir, ...ROUTE_CACHE_APP_PAGE);
  if (existsSync(cacheDir)) {
    for (const key of readdirSync(cacheDir)) {
      const pages = join(cacheDir, key, "$");
      if (!existsSync(pages)) continue;
      for (const rel of readdirSync(pages, { recursive: true })) {
        if (String(rel).endsWith(".html")) shells.set(toPath(String(rel)), join(pages, String(rel)));
      }
    }
  }
  const appDir = join(distDir, "server", "app");
  if (existsSync(appDir)) {
    for (const rel of readdirSync(appDir, { recursive: true })) {
      if (String(rel).endsWith(".html")) shells.set(toPath(String(rel)), join(appDir, String(rel)));
    }
  }
  return shells;
}

/**
 * HTML の body から、script・style・template・noscript の外の見える文字と、メニュー・リンク(nav・a・role="navigation")を取り出す
 * @param {string} html
 * @returns {{ frameRoot: boolean, text: string, navs: string[] }} navs = 見つけたメニュー・リンクの開きタグ(先頭 80 字)
 */
export function readShellBody(html) {
  // 穴の残る殻は </body> を持たない(流し込みが閉じる)ので、<body> から </body> か終わりまで
  const bodyMatch = /<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i.exec(html);
  const body = bodyMatch ? bodyMatch[1] : "";
  const markup = body.replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, "");
  const navs = (markup.match(/<(?:nav|a)\b[^>]*>|<[a-z][^>]*\srole="navigation"[^>]*>/gi) ?? []).map((tag) => tag.slice(0, 80));
  const visible = markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { frameRoot: /\sdata-frame-root(=|\s|>)/.test(body), text: visible, navs };
}

/**
 * 殻の中で開かれない区画(`<div hidden id="S:n">` … 対応する `</div>`)の範囲の一覧。
 * 中身の揃った区画は殻の中の `$RC("B:x","S:n")` がその場で開くので除く(開くのは流れの後 = 穴の読み手を待つ区画だけを返す)
 * @param {string} html 殻の HTML
 * @returns {Array<[number, number]>} [開きタグの位置, 閉じの後ろ]
 */
export function unrevealedSegments(html) {
  const revealed = new Set([...html.matchAll(/\$RC\(\s*"B:[^"]*"\s*,\s*"(S:[^"]*)"\s*\)/g)].map((m) => m[1]));
  const ranges = [];
  for (const m of html.matchAll(/<div hidden(?:="")? id="(S:[^"]*)"[^>]*>/g)) {
    if (revealed.has(m[1])) continue;
    // 区画の閉じ(div の入れ子を数える)
    const tags = /<div\b[^>]*>|<\/div>/g;
    tags.lastIndex = m.index + m[0].length;
    let depth = 1;
    let tag;
    while (depth > 0 && (tag = tags.exec(html))) depth += tag[0] === "</div>" ? -1 : 1;
    ranges.push([m.index, depth === 0 ? tags.lastIndex : html.length]);
  }
  return ranges;
}

/**
 * 殻の外枠(data-frame-root)が殻の中で開かれない区画(unrevealedSegments)の中にあるか。
 * 中にある = 枠は殻の DOM に入っても、同じ境界の読み手(Suspense の無い部品)が届く流れの終わりまで見えない
 * @param {string} html 殻の HTML
 */
export function frameRootHidden(html) {
  const root = html.search(/\sdata-frame-root(=|\s|>)/);
  if (root < 0) return false;
  return unrevealedSegments(html).some(([open, close]) => open < root && root < close);
}

/**
 * 殻の中で開かれない区画(unrevealedSegments)を中身ごと除く(殻を開いた時に見える物だけを残す)
 * @param {string} html
 */
export function stripHiddenSegments(html) {
  let out = "";
  let cursor = 0;
  for (const [open, close] of unrevealedSegments(html)) {
    if (open < cursor) continue; // 除いた区画の中の区画
    out += html.slice(cursor, open);
    cursor = close;
  }
  return out + html.slice(cursor);
}

/**
 * loader の文が殻に入る宣言をしているか(lib/pageGuard の createLoader): "no-load" = load を省いた / "shell" = `shell: true` / null = 既定(request 時)
 * @param {string} source loader の文(コメント込みでよい)
 */
export function loaderShellMode(source) {
  const src = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  if (!/\bcreateLoader\(\s*\{/.test(src)) return null;
  if (/\bshell\s*:\s*true\b/.test(src)) return "shell";
  return /\bload\s*:/.test(src) ? null : "no-load";
}

/**
 * 会員の枠(src/app/(user)/ の UserLayout)の下のページか
 * @param {{ chain?: Array<{ kind: string, file?: string }> }} row
 */
export function isUserFrame(row) {
  const page = (row?.chain ?? []).find((link) => link.kind === "page");
  return typeof page?.file === "string" && page.file.startsWith("src/app/(user)/");
}

/** 会員の枠の部位(殻に入ってよい、D57): この data-slot の要素は中身ごと除いて本文を見る */
export const USER_FRAME_PART_SLOTS = ["header", "footer", "bottom-nav"];

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/**
 * HTML から data-slot が slots のどれかの要素を中身ごと除く(タグの入れ子を数える。void の要素と /> で閉じる要素は数えない)
 * @param {string} html
 * @param {readonly string[]} slots
 * @returns {string}
 */
export function stripSlots(html, slots) {
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  let out = "";
  let cursor = 0;
  let skipDepth = 0;
  let skipStart = -1;
  let depth = 0;
  for (const m of html.matchAll(tagRe)) {
    const [tag, closing, name, selfClosing] = m;
    const isVoid = VOID_TAGS.has(name.toLowerCase()) || selfClosing === "/";
    if (skipStart < 0) {
      if (!closing && !isVoid && slots.some((slot) => tag.includes(` data-slot="${slot}"`))) {
        out += html.slice(cursor, m.index);
        skipStart = m.index;
        skipDepth = depth;
        depth += 1;
      } else if (!isVoid) depth += closing ? -1 : 1;
      continue;
    }
    if (isVoid) continue;
    depth += closing ? -1 : 1;
    if (closing && depth === skipDepth) {
      cursor = m.index + tag.length;
      skipStart = -1;
    }
  }
  return skipStart >= 0 ? out : out + html.slice(cursor);
}

/**
 * build の成果物の殻を見る(D50・D55・D57):
 * - 殻に入れない範囲(isHoleRange)のページの殻に、見える文字とメニュー・リンク(nav・a)が無い。「枠」は見える物(D55): 空の外枠の入れ物は入ってよい。
 *   会員の枠の下のログイン必須の範囲は、全員に同じ会員の枠の部位(USER_FRAME_PART_SLOTS)を除いた本文の側で見る(D57)
 * - 公開の範囲で会員の枠の下のページ(殻のあるもの、[param] を除く)の殻に、会員の枠(data-frame-root と部位の包み data-frame-part)がある。
 *   無い = どこかの読みが Suspense の外に出て、枠ごと root の穴に落ちた
 * - その枠が殻の未公開の区画(hidden の S:n)の外にある。中 = 枠と同じ境界に Suspense の無い読み手があり、流れの終わりまで見えない
 * - shell: true を宣言した公開のページ(loaderShellMode)は殻の本文に中身がある。守りの鎖の shell: true は問題(load を省いただけのページは見ない)
 * 殻に入れない範囲で殻の無いページ = 動的になった(殻を作らない)ので、閉じた機能のページ(gatedOff)のほかは問題
 * @param {string} distDir .next
 * @param {Array<{ path: string, gatedOff?: unknown, chain?: unknown[] }>} rows route-map.jsonl の行
 * @param {{ repoRoot?: string }} [options] loader のファイルを読む根(既定 = 今のディレクトリ)
 * @returns {{ problems: string[], holePages: number, publicPages: number, framedPages: number } | null} 殻の HTML が 1 本も見つからなければ null(未検証: locateShells の 2 つの置き場のどちらにも無い)
 */
export function checkShells(distDir, rows, { repoRoot = "." } = {}) {
  const shells = locateShells(distDir);
  if (shells.size === 0) return null;
  const problems = [];
  let holePages = 0;
  let framedPages = 0;
  for (const row of rows) {
    const file = shells.get(row.path) ?? shellPath(distDir, row.path);
    const loaderFile = (row.chain ?? []).find((link) => link.kind === "loader")?.file;
    const mode = loaderFile && existsSync(join(repoRoot, loaderFile)) ? loaderShellMode(readFileSync(join(repoRoot, loaderFile), "utf8")) : null;
    if (!isHoleRange(row)) {
      // shell: true を宣言した公開のページは、殻の本文の側(枠の部位・殻の中で開かれない区画を除く)に中身がある。
      // 無い = 宣言したのに request を読む部品がページにある(宣言の誤り)。load を省いただけのページは宣言ではないので見ない
      // (Screen の部品が Suspense の内側で searchParams 等を読むページは穴に残ってよい。遅くなるだけで正しさは変わらない)
      if (mode === "shell" && !row.path.includes("[") && !row.gatedOff && existsSync(file)) {
        const html = readFileSync(file, "utf8");
        const visible = stripHiddenSegments(isUserFrame(row) ? stripSlots(html, USER_FRAME_PART_SLOTS) : html);
        if (!readShellBody(visible).text) {
          problems.push(`${row.path}: loader が shell: true を宣言しているのに、殻の本文に中身が無い(ページの読みが穴に残っている: Screen・部品の request の読みを Suspense の内側へ、データ・request を読むなら宣言を外す)`);
        }
      }
      // 殻のあるページだけ(閉じた機能 gatedOff のページも build されて殻があれば見る。[param] のページは殻が params で穴になりうる)
      if (!isUserFrame(row) || row.path.includes("[") || !existsSync(file)) continue;
      framedPages += 1;
      const html = readFileSync(file, "utf8");
      const { frameRoot } = readShellBody(html);
      if (!frameRoot || !html.includes(" data-frame-part=")) {
        problems.push(`${row.path}: 公開の範囲の会員の枠のページの殻に枠(data-frame-root と部位の包み data-frame-part)が無い。枠より外か枠の根で request を読んでいる(読む部分を Suspense の内側へ)`);
      } else if (frameRootHidden(html)) {
        problems.push(`${row.path}: 公開の範囲の会員の枠が殻の未公開の区画(<div hidden id="S:n">)の中にあり、流れの終わりまで見えない。枠と同じ境界に Suspense の無い読み手(点の部品・slot)がある(その読み手を Suspense の内側へ)`);
      }
      continue;
    }
    holePages += 1;
    if (mode === "shell") problems.push(`${row.path}: 殻に入れない範囲(守りの鎖)の loader が shell: true を宣言している(意味を持たない: 外す)`);
    if (!existsSync(file)) {
      if (!row.gatedOff) problems.push(`${row.path}: 殻の HTML が無い(${file})。ページが殻を作らない形になった`);
      continue;
    }
    const html = readFileSync(file, "utf8");
    const { text, navs } = readShellBody(isUserFrame(row) ? stripSlots(html, USER_FRAME_PART_SLOTS) : html);
    if (text) problems.push(`${row.path}: 殻に入れない範囲(D50)のページの殻に見える文字がある(「${text.slice(0, 60)}」)。読む部分を Suspense の内側(穴)へ戻す`);
    if (navs.length > 0) problems.push(`${row.path}: 殻に入れない範囲(D50)のページの殻にメニュー・リンクがある(${navs[0]})。メニューを Suspense の内側(穴)へ戻す`);
  }
  return { problems, holePages, publicPages: rows.length - holePages, framedPages };
}
