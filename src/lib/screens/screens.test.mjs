// page 層(page.tsx スイッチ + Screen + loader)の規律テスト。
// 実行: pnpm test:screens (node:test + tsx。registry の .ts を読むため tsx ランナーを使う)
//
// 登録は不要。検査対象は自動検出する:
//   - src/app/(user)/** と src/app/(marketing)/** の page.tsx(demo/ を除く)
//   - fork が src/registry/screenRoutesRegistry.ts の FORK_SCAN_ROOTS に足したエリア(エリア単位で 1 行、ページ単位ではない)
//   - dc:generate が生成する管理画面ルート(src/features/*/domain.json の adminRoutes が false でないドメイン)
//   - 検出した各ルートの _screen/loader.ts と _components/loader.ts(ルート内 loader)
//   - src/features/**/services/server/loaders/*.ts(多数のルートが共有する loader。再 export だけのファイルは除く)
//
// 守りたい契約(設計: src/lib/screens/README.md):
// 1. page.tsx は「./_screen/<X> または ./_components/<X> からの 1 行 re-export」+ 任意のページ設定
//    (metadata / dynamic 等の export、generateMetadata、それらに必要な import)だけ。画面ロジックを page.tsx に置かない
// 2. 参照先の Screen が存在し、その名前を named export していて、default export も "use client" も持たない
// 3. loader は `import "server-only"` と React の cache() を使い load<Xxx> を export する(ルート内・共有とも同じ)
// 4. まだスイッチ化していない page.tsx は、理由付きで例外リストに載せる(黙って古いままにしない):
//    upstream = 下の UPSTREAM_LEGACY_ROUTES(Step 5b〜5e で縮め、最後は空)
//    fork     = src/registry/screenRoutesRegistry.ts の FORK_LEGACY_ROUTES
//    移行が済んだのに残っている行も失敗にする(一覧が縮む方向にしか動かない)
//
// 検査関数の本体は ./checks.mjs(副作用なし)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// fork の merge で export が欠けても import 時に落ちず、鮮度テストが指摘できるよう namespace import にする
import * as registry from "../../registry/screenRoutesRegistry.ts";
import { toCamelCase, toKebabCase, toPlural } from "../../utils/stringCase.mjs";
import {
  ROUTE_LOADER_FILE,
  SCREEN_DIRS,
  barrelTarget,
  checkLoaderFile,
  checkScreenFile,
  checkSwitchPage,
  isReexportOnlyFile,
  parseSwitchPage,
  stripComments,
} from "./checks.mjs";

export { checkLoaderFile, checkScreenFile, checkSwitchPage, isReexportOnlyFile, parseSwitchPage, stripComments };

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FORK_LEGACY_ROUTES = registry.FORK_LEGACY_ROUTES ?? [];
const FORK_SCAN_ROOTS = registry.FORK_SCAN_ROOTS ?? [];
const FORK_SCAN_EXCLUDES = registry.FORK_SCAN_EXCLUDES ?? [];
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");
const exists = (path) => existsSync(resolve(repoRoot, path));

/**
 * upstream がまだスイッチ化していない core ルート(理由 = 移行予定のステップ)。
 * 各ステップで移行したら行を外す。全て空になった時点で Step 5 完了
 */
export const UPSTREAM_LEGACY_ROUTES = [
  { dir: "src/app/(user)/(protected)/mypage", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/account", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/account/email", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/account/password", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/account/phone", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/account/profile", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/invite", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/other", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/pause", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(protected)/mypage/withdraw", reason: "Step 5c で移行" },
  { dir: "src/app/(user)/(legal)/privacy-policy", reason: "Step 5d で移行" },
  { dir: "src/app/(user)/(legal)/terms", reason: "Step 5d で移行" },
  { dir: "src/app/(user)/(legal)/tradelaw", reason: "Step 5d で移行" },
  { dir: "src/app/(user)/(public)/services", reason: "Step 5d で移行" },
  { dir: "src/app/(user)/maintenance", reason: "Step 5d で移行" },
  { dir: "src/app/(marketing)/entry", reason: "Step 5d で移行" },
  { dir: "src/app/(user)/(auth)/demo-login", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/email/verify", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/forgot-password", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/login", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/logout", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/password/reset", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/reactivate", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/reactivate/complete", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/restricted", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/signup", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/signup-closed", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/signup/complete", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/signup/email-sent", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/signup/oauth", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/signup/register", reason: "Step 5e で移行" },
  { dir: "src/app/(user)/(auth)/signup/verify", reason: "Step 5e で移行" },
];

// ---------------------------------------------------------------------------
// 検出
// ---------------------------------------------------------------------------

/** 走査するルート群(repo 相対)と除外プレフィックス。fork は registry の FORK_SCAN_ROOTS / FORK_SCAN_EXCLUDES で足す */
export const SCAN_ROOTS = ["src/app/(user)", "src/app/(marketing)"];
export const SCAN_EXCLUDES = ["src/app/(user)/demo"];
/** src/app 直下にある upstream のエリアのうち走査しないもの(手書きの管理画面・debug・API)。fork の独自エリアはここに無いので登録を促す */
export const UPSTREAM_KNOWN_AREAS = ["src/app/admin", "src/app/debug", "src/app/api"];

// 形式違いの登録(文字列以外・ファイル)は走査から外し、鮮度テストだけが指摘する(走査で落ちてスイート全体が止まらないように)
const isDir = (rel) => {
  try {
    return statSync(resolve(repoRoot, rel)).isDirectory();
  } catch {
    return false;
  }
};
const validEntries = (list) => list.filter((x) => typeof x === "string" && isDir(x));
const scanRoots = [...SCAN_ROOTS, ...validEntries(FORK_SCAN_ROOTS)];
const scanExcludes = [...SCAN_EXCLUDES, ...FORK_SCAN_EXCLUDES.filter((x) => typeof x === "string")];
/** rel が prefix そのものか、その配下(セグメント単位。`src/app/store` は `src/app/storefront` を含まない) */
const isUnder = (rel, prefix) => rel === prefix || rel.startsWith(`${prefix}/`);

/** 再帰的に page.tsx を集める(_ で始まるディレクトリと除外プレフィックスは入らない) */
function collectPages(dirRel) {
  const out = [];
  const abs = resolve(repoRoot, dirRel);
  if (!isDir(dirRel)) return out;
  for (const entry of readdirSync(abs)) {
    const rel = join(dirRel, entry);
    if (scanExcludes.some((ex) => isUnder(rel, ex))) continue;
    const full = resolve(repoRoot, rel);
    if (statSync(full).isDirectory()) {
      // _ = プライベートフォルダ、@ = 並列ルートのスロット(page 層の対象外)
      if (entry.startsWith("_") || entry.startsWith("@")) continue;
      out.push(...collectPages(rel));
    } else if (entry === "page.tsx") {
      out.push(rel);
    }
  }
  return out;
}

/** dc:generate が管理画面ルートを生成するドメインのディレクトリ(domain.json から導出) */
export function generatedAdminRouteDirs() {
  const featuresDir = resolve(repoRoot, "src/features");
  const dirs = [];
  for (const name of readdirSync(featuresDir)) {
    const configPath = join(featuresDir, name, "domain.json");
    if (!existsSync(configPath)) continue;
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const generateBlock = Object.values(config).find((v) => v && typeof v === "object" && !Array.isArray(v) && "adminRoutes" in v);
    const adminRoutes = generateBlock?.adminRoutes ?? config.adminRoutes ?? true;
    if (adminRoutes === false) continue;
    // 生成器と同じ導出: plural があればそれ、無ければ toPlural(camel)
    const camelPlural = config.plural ? toCamelCase(config.plural) : toPlural(toCamelCase(name) || name);
    dirs.push(`src/app/admin/(protected)/${toKebabCase(camelPlural)}`);
  }
  return dirs;
}

/** 検査対象の page.tsx 一覧(repo 相対パス、ソート済み) */
export function discoverPages() {
  const pages = [];
  for (const root of scanRoots) pages.push(...collectPages(root));
  for (const dir of generatedAdminRouteDirs()) pages.push(...collectPages(dir));
  return [...new Set(pages)].sort();
}

/**
 * src/app 直下のディレクトリのうち page.tsx を含み、走査範囲(SCAN_ROOTS / FORK_SCAN_ROOTS。エリア自身か
 * その中のどこかが登録されていればよい)にも、upstream 既知のエリア・fork の除外(エリア自身がその中にあるときだけ)にも
 * 属さないもの。fork が独自エリアを作って登録を忘れた状態を黙って通さないために使う。
 * page.tsx の無いディレクトリ(route.ts だけの sitemap.xml/ 等)と . 始まりは対象外。
 * 限界: upstream エリアの中(src/app/admin/(protected)/<fork-dir> 等)は見ない
 */
export function unknownTopLevelAreas() {
  const appDir = resolve(repoRoot, "src/app");
  const skipped = [...UPSTREAM_KNOWN_AREAS, ...scanExcludes];
  const out = [];
  for (const entry of readdirSync(appDir)) {
    if (entry.startsWith("_") || entry.startsWith("@") || entry.startsWith(".")) continue;
    const rel = `src/app/${entry}`;
    if (!isDir(rel)) continue;
    if (scanRoots.some((c) => isUnder(c, rel) || isUnder(rel, c))) continue;
    if (skipped.some((c) => isUnder(rel, c))) continue;
    if (collectPages(rel).length === 0) continue;
    out.push(rel);
  }
  return out.sort();
}

/**
 * FORK_SCAN_ROOTS / FORK_SCAN_EXCLUDES の鮮度。形式違い(文字列でない・src/app/ 始まりでない・末尾 /)、
 * 存在しないディレクトリ(ファイルも不可)、重複、upstream の走査範囲(SCAN_ROOTS / 生成された管理画面ルート)に
 * 既に含まれる root、upstream のエリアを丸ごと含む root(サブディレクトリ単位で登録する)、除外の中にある root(走査されない)、
 * 他の fork root の中にある root(登録不要)を返す
 */
export function staleScanEntries() {
  const stale = [];
  const upstreamCovered = [...SCAN_ROOTS, ...generatedAdminRouteDirs()];
  const checkShape = (list, name) => {
    for (const [i, dir] of list.entries()) {
      if (typeof dir !== "string" || !dir.startsWith("src/app/") || dir.endsWith("/")) stale.push(`${name}: ${JSON.stringify(dir)}(repo 相対の src/app/... を末尾 / 無しで書く)`);
      else if (!isDir(dir)) stale.push(`${name}: ${dir}(ディレクトリとして存在しない。削除済みなら行を外す)`);
      if (list.indexOf(dir) !== i) stale.push(`${name}: ${dir}(重複)`);
    }
  };
  checkShape(FORK_SCAN_ROOTS, "FORK_SCAN_ROOTS");
  checkShape(FORK_SCAN_EXCLUDES, "FORK_SCAN_EXCLUDES");
  for (const dir of FORK_SCAN_ROOTS) {
    if (typeof dir !== "string") continue;
    const by = upstreamCovered.find((c) => isUnder(dir, c));
    if (by) stale.push(`FORK_SCAN_ROOTS: ${dir}(${by} で既に走査される。登録不要)`);
    const contains = [...UPSTREAM_KNOWN_AREAS, ...upstreamCovered].find((c) => c !== dir && isUnder(c, dir));
    if (contains) stale.push(`FORK_SCAN_ROOTS: ${dir}(upstream のエリア ${contains} を丸ごと含む。独自のサブディレクトリ単位で登録する)`);
    const excluded = scanExcludes.find((ex) => isUnder(dir, ex));
    if (excluded) stale.push(`FORK_SCAN_ROOTS: ${dir}(除外 ${excluded} の中にあり走査されない)`);
    const outer = FORK_SCAN_ROOTS.find((o) => typeof o === "string" && o !== dir && isUnder(dir, o));
    if (outer) stale.push(`FORK_SCAN_ROOTS: ${dir}(${outer} で既に走査される。登録不要)`);
  }
  return stale;
}

/**
 * ルート内 loader の一覧(検出した各ルートの _screen/loader.ts と _components/loader.ts のうち存在するもの)。
 * ルートの loader は必ずここに置く(README §4)。features 側は多数のルートが共有する loader だけ
 */
export function discoverRouteLoaders(pageDirs) {
  const out = [];
  for (const dir of pageDirs) {
    for (const screenDir of SCREEN_DIRS) {
      const rel = `${dir}/${screenDir}/${ROUTE_LOADER_FILE}.ts`;
      if (exists(rel)) out.push(rel);
    }
  }
  return out.sort();
}

/**
 * 共有 loader の一覧(src/features 配下の services/server/loaders/ にある .ts)。
 * 再 export だけのファイル(旧パス互換の shim、barrel)は本体が別にあるので対象外
 */
export function discoverSharedLoaders() {
  const out = [];
  const walk = (dirRel) => {
    const abs = resolve(repoRoot, dirRel);
    for (const entry of readdirSync(abs)) {
      const rel = join(dirRel, entry);
      const full = resolve(repoRoot, rel);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules") continue;
        walk(rel);
      } else if (
        /\/services\/server\/loaders\/[^/]+\.ts$/.test(`/${rel}`) &&
        !/\.test\.ts$/.test(entry) &&
        entry !== "index.ts" &&
        entry !== "types.ts" &&
        !isReexportOnlyFile(read(rel))
      ) {
        // loaders/ 直下の .ts は全て loader とみなす(index.ts / types.ts / 再 export だけのファイルを除く。補助関数は utils/ へ)
        out.push(rel);
      }
    }
  };
  walk("src/features");
  return out.sort();
}

/** 互換 API: 共有 loader の一覧 */
export const discoverLoaders = discoverSharedLoaders;

/**
 * page.tsx の参照先 Screen を実ファイルに解決する。
 * <dir>/<screenDir>/<file>.tsx → <file>.ts → <file>/index.tsx → <file>/index.ts の順。
 * barrel(`export { X } from "./Y"`)なら 1 段だけ辿る。見つからなければ null
 */
export function resolveScreenFile(pageDir, target) {
  const base = `${pageDir}/${target.screenDir}/${target.file}`;
  const candidates = [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`];
  const found = candidates.find((c) => exists(c));
  if (!found) return null;
  const inner = barrelTarget(read(found), target.name);
  if (inner) {
    const innerBase = `${dirname(found)}/${inner}`;
    const innerFound = [`${innerBase}.tsx`, `${innerBase}.ts`, `${innerBase}/index.tsx`].find((c) => exists(c));
    if (innerFound) return innerFound;
  }
  return found;
}

// ---------------------------------------------------------------------------
// テスト本体
// ---------------------------------------------------------------------------

const legacyEntries = [...UPSTREAM_LEGACY_ROUTES, ...FORK_LEGACY_ROUTES];
const legacyDirs = new Map(legacyEntries.map((e) => [e.dir, e.reason]));
const pages = discoverPages();
const pageDirs = new Set(pages.map((p) => dirname(p)));

for (const page of pages) {
  const dir = dirname(page);
  const { problems, target } = parseSwitchPage(read(page));
  const isLegacy = legacyDirs.has(dir);

  test(`${dir}: page.tsx は Screen への 1 行スイッチ`, (t) => {
    if (problems.length > 0 && isLegacy) {
      t.skip(`未移行(例外リストに記載): ${legacyDirs.get(dir)}`);
      return;
    }
    assert.deepEqual(
      problems,
      [],
      `${page}: ${problems.join(" / ")}\n→ page.tsx を \`export { XScreen as default } from "./_screen/XScreen"\` にして本体を _screen/ へ移すか、` +
        `まだ移行しないなら理由を添えて例外リスト(upstream: UPSTREAM_LEGACY_ROUTES / fork: src/registry/screenRoutesRegistry.ts)に載せる`,
    );
  });

  if (problems.length === 0 && target) {
    test(`${dir}: ${target.screenDir}/${target.file} が ${target.name} を named export する Server Component`, () => {
      const file = resolveScreenFile(dir, target);
      assert.ok(file, `${dir}/${target.screenDir}/${target.file}(.tsx | /index.tsx) が無い`);
      const screenProblems = checkScreenFile(read(file), target.name);
      assert.deepEqual(screenProblems, [], `${file}: ${screenProblems.join(" / ")}`);
    });
  }
}

const routeLoaders = discoverRouteLoaders(pageDirs);
for (const loader of [...routeLoaders, ...discoverSharedLoaders()]) {
  test(`${loader}: loader は server-only + cache() + load<Xxx>、_components / Screen を import しない、(protected) なら getSessionUser を使わない`, () => {
    const problems = checkLoaderFile(read(loader), { path: loader });
    assert.deepEqual(problems, [], `${loader}: ${problems.join(" / ")}`);
  });
}

/**
 * 例外リストの鮮度。「移行済み」= page.tsx が ./_screen/ へのスイッチになったとき。
 * ./_components/ へ向いているのは「その一覧の所有者ではない側(下流)が差し替えた」状態なので移行済み扱いにしない
 * (fork が upstream の未移行ルートを先に差し替えても、fork では編集できない UPSTREAM_LEGACY_ROUTES が失敗しない)。
 * 検査対象に無いルート(削除済み)は、所有者が編集できる一覧(fork の FORK_LEGACY_ROUTES)でだけ指摘する。
 */
function staleLegacyEntries(entries, { ownerEditable }) {
  const stale = [];
  for (const entry of entries) {
    assert.equal(typeof entry.dir, "string", `例外リストの entry に dir が無い: ${JSON.stringify(entry)}`);
    assert.ok(typeof entry.reason === "string" && entry.reason.trim(), `例外リストの ${entry.dir} に reason が無い(理由を明示する)`);
    if (!pageDirs.has(entry.dir)) {
      if (ownerEditable) stale.push(`${entry.dir}(検査対象に無い。削除済みか走査範囲外)`);
      continue;
    }
    const { problems, target } = parseSwitchPage(read(`${entry.dir}/page.tsx`));
    if (problems.length === 0 && target?.screenDir === "_screen") stale.push(`${entry.dir}(移行済み。例外リストから外す)`);
  }
  return stale;
}

test("UPSTREAM_LEGACY_ROUTES: 移行済み(_screen へのスイッチ)のルートが残っていない", () => {
  const stale = staleLegacyEntries(UPSTREAM_LEGACY_ROUTES, { ownerEditable: false });
  assert.deepEqual(stale, [], `upstream の例外リストを更新する:\n${stale.join("\n")}`);
});

test("FORK_LEGACY_ROUTES: 移行済み・存在しないルートが残っておらず、upstream の一覧と重複しない", () => {
  const stale = staleLegacyEntries(FORK_LEGACY_ROUTES, { ownerEditable: true });
  assert.deepEqual(stale, [], `src/registry/screenRoutesRegistry.ts を更新する:\n${stale.join("\n")}`);
  const upstreamDirs = new Set(UPSTREAM_LEGACY_ROUTES.map((e) => e.dir));
  const dup = FORK_LEGACY_ROUTES.map((e) => e.dir).filter((d, i, a) => a.indexOf(d) !== i || upstreamDirs.has(d));
  assert.deepEqual(dup, [], `例外リストに重複(upstream の一覧にあるものは登録不要): ${dup.join(", ")}`);
});

test("FORK_SCAN_ROOTS / FORK_SCAN_EXCLUDES: 存在しない・upstream が既に走査する・重複した登録が無い", () => {
  const stale = staleScanEntries();
  assert.deepEqual(stale, [], `src/registry/screenRoutesRegistry.ts を更新する:\n${stale.join("\n")}`);
});

test("src/app 直下に、走査範囲にも既知のエリアにも属さないディレクトリが無い(fork の独自エリアは FORK_SCAN_ROOTS に登録する)", () => {
  const unknown = unknownTopLevelAreas();
  assert.deepEqual(
    unknown,
    [],
    `src/registry/screenRoutesRegistry.ts に 1 行足す(検査するなら FORK_SCAN_ROOTS、検査しないなら FORK_SCAN_EXCLUDES):\n${unknown.join("\n")}`,
  );
});

// wallet ルートは fork が削除してよい(README §7)ので、ディレクトリがあるときだけ「検出されること」を検査する
const walletDir = "src/app/(user)/(protected)/wallet";
const hasWallet = exists(`${walletDir}/page.tsx`);

test("検出範囲: wallet ルート(あれば)と生成された管理画面ルートが含まれ、demo は含まれない", () => {
  if (hasWallet) {
    assert.ok(pageDirs.has(walletDir));
    assert.ok(pageDirs.has(`${walletDir}/[slug]/history`));
  }
  assert.ok(pageDirs.has("src/app/(user)"), "トップページ(_components/StarterHome 方式)が検出されていない");
  assert.ok([...pageDirs].some((d) => d.startsWith("src/app/admin/(protected)/")), "生成された管理画面ルートが検出されていない");
  assert.equal([...pageDirs].some((d) => d.startsWith("src/app/(user)/demo")), false);
});

test("検出範囲: ルート内 loader(wallet 配下 9 件、あれば)が検出され、共有 loader は admin のものが検出される", () => {
  if (hasWallet) {
    for (const route of [
      "",
      "/[slug]",
      "/[slug]/history",
      "/[slug]/purchase",
      "/[slug]/purchase/awaiting-review",
      "/[slug]/purchase/bank-transfer/[requestId]",
      "/[slug]/purchase/callback",
      "/[slug]/purchase/complete",
      "/[slug]/purchase/failed",
    ]) {
      assert.ok(routeLoaders.includes(`${walletDir}${route}/_screen/loader.ts`), `${walletDir}${route} の loader が検出されていない`);
    }
  }
  const shared = discoverSharedLoaders();
  assert.ok(shared.some((l) => l.startsWith("src/features/core/admin/services/server/loaders/")), "管理画面の共有 loader が検出されていない");
});

// ---------------------------------------------------------------------------
// 検査関数の自己検査
// ---------------------------------------------------------------------------

test("stripComments: 行コメント内の /** をブロックコメントの開始と誤認しない", () => {
  const src = `// see /api/me/** for the route\nimport "server-only";\n/* block */ const a = "// not a comment"; // tail\nconst b = \`/* keep */\`;`;
  const out = stripComments(src);
  assert.ok(out.includes('import "server-only"'));
  assert.ok(out.includes('"// not a comment"'));
  assert.ok(out.includes("`/* keep */`"));
  assert.equal(out.includes("block"), false);
  assert.equal(out.includes("tail"), false);
  assert.equal(out.split("\n").length, src.split("\n").length, "行数を保つ");
});

test("parseSwitchPage: _screen / _components / metadata re-export を許可し、画面ロジックを弾く", () => {
  const ok = `
    import type { Metadata } from "next";
    import { createMetadata } from "@/lib/metadata";
    import { loadWalletBalanceScreen, type WalletBalanceScreenParams } from "./_screen/loader";
    import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
    import type { ScreenProps } from "@/lib/screens/types";

    export const dynamic = "force-dynamic";
    export const metadata: Metadata = {
      title: "ウォレット",
      openGraph: { images: ["/og.png"] },
    };

    export async function generateMetadata(props: ScreenProps<WalletBalanceScreenParams>): Promise<Metadata> {
      const { label } = await loadWalletBalanceScreen(props);
      return createMetadata({ title: \`\${label}管理\` });
    }

    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.deepEqual(parseSwitchPage(ok).problems, []);
  assert.deepEqual(parseSwitchPage(ok).target, { screenDir: "_screen", file: "WalletBalanceScreen", name: "WalletBalanceScreen" });
  assert.deepEqual(checkSwitchPage(ok, "WalletBalanceScreen"), []);

  const replaced = `export { Home as default } from "./_components/Home";`;
  assert.deepEqual(parseSwitchPage(replaced).problems, []);
  assert.equal(parseSwitchPage(replaced).target.screenDir, "_components");
  assert.ok(checkSwitchPage(replaced, "HomeScreen").length > 0, "期待名を指定したときは _screen の同名であること");

  const satisfies = `
    import type { Metadata, Viewport } from "next";
    export const metadata = { title: "x" } satisfies Metadata;
    export const viewport: Viewport = { themeColor: "#000" };
    export function generateViewport(): Viewport { return { themeColor: "#fff" }; }
    export { XScreen as default } from "./_screen/XScreen";
  `;
  assert.deepEqual(parseSwitchPage(satisfies).problems, []);

  const defaultSpec = `export { default } from "./_screen/XScreen";`;
  assert.ok(parseSwitchPage(defaultSpec).problems.some((p) => p.includes("default export しない")));

  const generated = `
    export const dynamic = "force-dynamic";
    export { AdminSampleListScreen as default, metadata } from "./_screen/AdminSampleListScreen";
  `;
  assert.deepEqual(parseSwitchPage(generated).problems, []);

  const dynamicReexport = `export { AdminSampleListScreen as default, dynamic } from "./_screen/AdminSampleListScreen";`;
  assert.ok(parseSwitchPage(dynamicReexport).problems.some((p) => p.includes("dynamic")));

  const jsx = `
    import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
    export default function Page() { return <UserPage />; }
  `;
  assert.ok(parseSwitchPage(jsx).problems.length > 0);

  const navigation = `
    import { notFound } from "next/navigation";
    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(parseSwitchPage(navigation).problems.some((p) => p.includes("next/navigation")));

  const sectionContainer = `
    import { WalletBalancePage } from "@/features/core/wallet/components/WalletBalancePage";
    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(parseSwitchPage(sectionContainer).problems.some((p) => p.includes("components/WalletBalancePage")));

  // generateMetadata がルート内 loader を呼ぶ形(_screen / _components どちらの loader も可)
  const routeLoader = `
    import type { Metadata } from "next";
    import { loadWalletBalanceScreen } from "./_screen/loader";
    export async function generateMetadata(props: ScreenProps<{ slug: string }>): Promise<Metadata> {
      const { label } = await loadWalletBalanceScreen(props);
      return { title: label };
    }
    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.deepEqual(parseSwitchPage(routeLoader).problems, []);
  assert.deepEqual(parseSwitchPage(routeLoader.replace("./_screen/loader", "./_components/loader")).problems, []);
  assert.ok(parseSwitchPage(routeLoader.replace("./_screen/loader", "./_screen/utils")).problems.length > 0, "loader 以外の相対 import は不可");
});

test("checkScreenFile: named export / barrel を認め、default export と \"use client\" を弾く", () => {
  assert.deepEqual(checkScreenFile(`export async function XScreen() { return null; }`, "XScreen"), []);
  assert.deepEqual(checkScreenFile(`export { XScreen } from "./XScreen";`, "XScreen"), []);
  assert.ok(checkScreenFile(`export default function XScreen() {}`, "XScreen").length > 0);
  assert.ok(checkScreenFile(`"use client";\nexport function XScreen() { return null; }`, "XScreen").some((p) => p.includes("use client")));
  assert.ok(checkScreenFile(`export function Other() {}`, "XScreen").length > 0);
});

test("例外リストの鮮度: _components への差し替えは移行済み扱いにしない(fork で upstream の一覧が落ちない)", () => {
  // tradelaw は upstream の未移行ルート。fork が ./_components/ に差し替えた状態を想定して判定だけ確認する
  const forkReplaced = `export { Tradelaw as default } from "./_components/Tradelaw";`;
  const { problems, target } = parseSwitchPage(forkReplaced);
  assert.deepEqual(problems, []);
  assert.equal(target.screenDir, "_components");
  const upstreamMigrated = `export { TradelawScreen as default } from "./_screen/TradelawScreen";`;
  assert.equal(parseSwitchPage(upstreamMigrated).target.screenDir, "_screen");
});

test("checkLoaderFile: 共有 loader(load<Xxx>)も個別 loader(load<Name>Screen)も通る。void loader も純粋な解釈だけの loader も cache() は必須", () => {
  const good = `import "server-only";\nimport { cache } from "react";\nconst r = cache(async () => 1);\nexport async function loadAdminRelationLists() { return r(); }`;
  assert.deepEqual(checkLoaderFile(good), []);
  const voidLoader = `import "server-only";\nimport { cache } from "react";\nimport { redirect } from "next/navigation";\nexport const loadFriendCouponScreen = cache(async (): Promise<void> => { if (!enabled()) redirect("/mypage"); });`;
  assert.deepEqual(checkLoaderFile(voidLoader), []);
  const noCache = `import "server-only";\nexport async function loadItemListScreen(props) { const { status } = await props.params; return { status }; }`;
  assert.ok(checkLoaderFile(noCache).some((p) => p.includes("cache()")));
  const bad = `import { cache } from "react";\nexport const helper = 1;`;
  assert.ok(checkLoaderFile(bad).length >= 2);
});

test("checkLoaderFile: DTO 型は loader が所有する(_components / Screen からの import は type でも不可)", () => {
  const base = `import "server-only";\nimport { cache } from "react";\n`;
  const ok = `${base}import type { ScreenProps } from "@/lib/screens/types";\nimport { userService } from "@/features/core/user/services/server/userService";\nexport type WinReportScreenData = { reports: string[] };\nexport const loadWinReportScreen = cache(async () => ({ reports: [] }));`;
  assert.deepEqual(checkLoaderFile(ok, { path: "src/app/(user)/(protected)/win-reports/_screen/loader.ts" }), []);
  const fromParts = `${base}import type { WinReportData } from "../_components/WinReportList";\nexport const loadWinReportScreen = cache(async (): Promise<WinReportData[]> => []);`;
  assert.ok(checkLoaderFile(fromParts).some((p) => p.includes("../_components/WinReportList")));
  const fromScreen = `${base}import type { Props } from "./WinReportScreen";\nexport const loadWinReportScreen = cache(async (): Promise<Props> => ({}));`;
  assert.ok(checkLoaderFile(fromScreen).some((p) => p.includes("./WinReportScreen")));
  const reexport = `${base}export type { X } from "../_components/X";\nexport const loadXScreen = cache(async () => 1);`;
  assert.ok(checkLoaderFile(reexport).some((p) => p.includes("../_components/X")));
  // 下流の _components/loader.ts が既定 loader(../_screen/loader)を呼ぶのは正しい方向
  const forkLoader = `${base}import { loadWalletBalanceScreen } from "../_screen/loader";\nexport const loadWalletBalanceExtra = cache(async (slug: string) => ({ slug }));`;
  const forkLoaderPath = "src/app/(user)/(protected)/wallet/[slug]/_components/loader.ts";
  assert.deepEqual(checkLoaderFile(forkLoader, { path: forkLoaderPath }), []);
  // _components/loader.ts からの ./Part は _components/ 内(相対 import を loader の位置から解決する)
  const forkFromPart = `${base}import type { WinReportData } from "./WinReportList";\nexport const loadWinReportExtra = cache(async (): Promise<WinReportData[]> => []);`;
  assert.ok(checkLoaderFile(forkFromPart, { path: forkLoaderPath }).some((p) => p.includes("./WinReportList")));
  // Screen 名の判定は相対 import か _screen/ / _components/ 配下だけ(ドメインの型ファイルは誤検出しない)
  const typesFile = `${base}import type { WalletIndexScreen } from "@/features/core/wallet/types/WalletIndexScreen";\nexport const loadWalletIndexScreen = cache(async (): Promise<WalletIndexScreen> => ({}));`;
  assert.deepEqual(checkLoaderFile(typesFile), []);
  const dirScreen = `${base}import type { Props } from "../_screen/WinReportScreen/index";\nexport const loadWinReportScreen = cache(async (): Promise<Props> => ({}));`;
  assert.ok(checkLoaderFile(dirScreen).some((p) => p.includes("WinReportScreen")));
  assert.deepEqual(checkLoaderFile(ok, null), [], "options に null を渡しても落ちない");
});

test("checkLoaderFile: (protected) 配下の loader は getSessionUser を使わない(requireCurrentUser のみ)。公開ルートでは可", () => {
  const tolerant = `import "server-only";\nimport { cache } from "react";\nimport { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";\nexport const loadPlayScreen = cache(async () => { const s = await getSessionUser(); return { userId: s?.userId ?? null }; });`;
  assert.ok(checkLoaderFile(tolerant, { path: "src/app/(user)/(protected)/play/[batchId]/_screen/loader.ts" }).some((p) => p.includes("getSessionUser")));
  assert.ok(checkLoaderFile(tolerant, { path: "src/app/admin/(protected)/floor-tables/_screen/loader.ts" }).some((p) => p.includes("getSessionUser")));
  assert.deepEqual(checkLoaderFile(tolerant, { path: "src/app/(marketing)/gacha/[id]/_screen/loader.ts" }), []);
  assert.deepEqual(checkLoaderFile(tolerant), [], "path 省略時は protected 判定をしない(checker 単体の互換)");
  const namespaced = `import "server-only";\nimport { cache } from "react";\nimport * as session from "@/features/core/auth/services/server/session/getSessionUser";\nexport const loadPlayScreen = cache(async () => ({ s: await session.getSessionUser() }));`;
  assert.ok(checkLoaderFile(namespaced, { path: "src/app/(user)/(protected)/play/_screen/loader.ts" }).some((p) => p.includes("getSessionUser")), "namespace import も import 元で検出");
  const strict = `import "server-only";\nimport { cache } from "react";\nimport { requireCurrentUser } from "@/features/core/user/services/server/userService";\nexport const loadPlayScreen = cache(async () => { const u = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" }); return { userId: u.id }; });`;
  assert.deepEqual(checkLoaderFile(strict, { path: "src/app/(user)/(protected)/play/[batchId]/_screen/loader.ts" }), []);
});

test("isReexportOnlyFile: 再 export だけのファイル(旧パス shim / barrel)を見分ける", () => {
  assert.equal(isReexportOnlyFile(`import "server-only";\nexport { loadXScreen, type XData } from "@/app/x/_screen/loader";`), true);
  assert.equal(isReexportOnlyFile(`import "server-only";\nexport type { XData } from "./loader";\nexport {\n  loadXScreen,\n} from "./loader";`), true);
  assert.equal(isReexportOnlyFile(`export * from "./a";\nexport * as ns from "./n";\nexport { b } from "./b";`), true);
  assert.equal(isReexportOnlyFile(`import "server-only";\nexport const loadXScreen = cache(async () => 1);`), false);
  assert.equal(isReexportOnlyFile(`const loadXScreen = cache(async () => 1);\nexport { loadXScreen };`), false, "from 無しの export { local } は宣言扱い");
  assert.equal(isReexportOnlyFile(`export type X = { a: 1 };\nexport { y } from "./y";`), false);
  assert.equal(isReexportOnlyFile(`export default 1;`), false);
  assert.equal(isReexportOnlyFile(`const a = 1;`), false);
});
