// page 層(page.tsx スイッチ + Screen + loader)の規律テスト。
// 実行: pnpm test scripts/structure/routes/screens.test.mjs (node:test + tsx。registry の .ts を読むため tsx ランナーを使う)
//
// 登録は不要。検査対象は自動検出する(M1):
//   - src/app 全体のページ(./routeTree.mjs の discoverRoutes。`_` で始まるフォルダと src/app/api を除く、@slot は含む)から、
//     SCAN_EXCLUDES と fork の forkScanExcludes(上書き src/config/lib/screens.config.ts、既定 src/lib/screens/config.ts)の配下を除いたもの
//     (除外は構造の検査だけ。ルート地図 src/app/route-map.jsonl には除外したページも載る)
//   - 検出した各ルートの _screen/loader.ts と _components/loader.ts(ルート内 loader)
//
// 守りたい契約(設計: src/lib/screens/README.md):
// 1. page.tsx は「./_screen/<X> または ./_components/<X> からの `export { X as default, generateMetadata }`」+ 任意のページ設定
//    (viewport 等、それらに必要な import)だけ。静的な metadata・自前の generateMetadata・dynamic 等 5 つ(cacheComponents と両立しない)は違反。画面ロジックを page.tsx に置かない
// 2. 参照先の Screen が存在し、`export const { Screen: X, generateMetadata } = createScreen({ load: <同じルートの loader>, … })`(@/wiring/screen)で、default export も "use client" も持たない(D110)
// 3. loader は `import "server-only"` と、最寄りの guard.ts の createLoader(Factory が cache を張る)か React の cache() を使い load<Xxx> を export する
// 4. 未移行の例外リストは無い(upstream も fork も全ページがスイッチ形、D30 K11)。スイッチでない page.tsx は失敗
// 5. 枠を描く layout.tsx(FRAME_LAYOUTS)と ./_layout/ を指す re-export を持つ layout.tsx は page.tsx と同じ 1 行スイッチ形
//    (参照先は ./_layout/<X>、採用者所有・write-once)。全 Tier で検査する。ガード付きの layout.tsx が ./_layout/ の枠を
//    素の import で描くのはスイッチではない(提供者所有、検査対象外)
//
// 検査関数の本体は src/lib/screens/checks.mjs(副作用なし、入口 "./node")。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { screensConfig } from "../../../src/lib/screens/index.ts";
import {
  ROUTE_LOADER_FILE,
  SCREEN_DIRS,
  barrelTarget,
  checkScreenLoaderCall,
  checkLoaderFile,
  checkAdminPageScreen,
  checkScreenFile,
  checkScreenImports,
  checkLayoutTarget,
  checkSwitchPage,
  findDotNamedFiles,
  findForkOwnedDirFiles,
  findMarkerNamedFiles,
  findOrphanReplaceFiles,
  describeRouteReplaceProblem,
  findRouteReplaceProblems,
  isReexportOnlyFile,
  parseSwitchLayout,
  parseSwitchPage,
  stripComments,
  discoverRoutes,
  listAppFiles,
} from "../../../src/lib/screens/node.mjs";
import { loadCatalogOwnership } from "../../../src/lib/folderCatalog/node.mjs";

export { checkLoaderFile, checkScreenFile, checkScreenImports, checkSwitchPage, isReexportOnlyFile, parseSwitchPage, stripComments };

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FORK_SCAN_EXCLUDES = screensConfig.forkScanExcludes;
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");
const exists = (path) => existsSync(resolve(repoRoot, path));

/**
 * upstream の枠を描く layout.tsx(1 行スイッチ形であること。ファイルが無ければ = fork がルートを消した → 検査しない)。
 * ガードと同居する admin/(protected) の layout.tsx は提供者所有のまま(報告書 §7)なので載せない
 */
export const FRAME_LAYOUTS = [
  "src/app/(user)/layout.tsx",
  "src/app/(user)/(protected)/mypage/layout.tsx",
  "src/app/admin/layout.tsx",
  "src/app/(marketing)/layout.tsx",
];

/** スイッチの印 = ./_layout/ を指す re-export(`export { X as default } from "./_layout/X"`)。素の import はガード付き layout の枠の描画 */
const SWITCH_REEXPORT = /export\s*\{[^}]*\}\s*from\s*["']\.\/_layout\//;

// ---------------------------------------------------------------------------
// 検出
// ---------------------------------------------------------------------------

/**
 * 構造の検査から外すディレクトリとその配下(repo 相対)。upstream は空(デモも 1 行スイッチ + _screen/ + loader の形)。
 * fork は上書きの forkScanExcludes で足す。ルート地図からは外さない(認可の一覧に例外を作らない)
 */
export const SCAN_EXCLUDES = [];

// 形式違いの登録(文字列以外・ファイル)は鮮度テストだけが指摘する(走査で落ちてスイート全体が止まらないように)
const isDir = (rel) => {
  try {
    return statSync(resolve(repoRoot, rel)).isDirectory();
  } catch {
    return false;
  }
};
const scanExcludes = [...SCAN_EXCLUDES, ...FORK_SCAN_EXCLUDES.filter((x) => typeof x === "string")];
/** rel が prefix そのものか、その配下(セグメント単位。`src/app/store` は `src/app/storefront` を含まない) */
const isUnder = (rel, prefix) => rel === prefix || rel.startsWith(`${prefix}/`);

/** src/app 全体のページ(ルート地図と同じ発見)。同じ URL のページが 2 つあれば throw(Next もビルドで失敗する構成) */
function discoverAllRoutes() {
  const { routes, problems } = discoverRoutes(listAppFiles(repoRoot));
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return routes;
}

/** 検査対象のページファイル一覧(repo 相対パス、ソート済み。除外の配下を除く) */
export function discoverPages() {
  return discoverAllRoutes()
    .map((r) => r.page)
    .filter((page) => !scanExcludes.some((ex) => isUnder(page, ex)))
    .sort();
}

/**
 * forkScanExcludes の鮮度。
 * 形式違い(文字列でない・src/app/ 始まりでない・末尾 /)、存在しないディレクトリ(ファイルも不可)、
 * 重複、他の除外の中にある登録を返す
 */
export function staleScanEntries() {
  const stale = [];
  for (const [i, dir] of FORK_SCAN_EXCLUDES.entries()) {
    if (typeof dir !== "string" || !dir.startsWith("src/app/") || dir.endsWith("/")) {
      stale.push(`forkScanExcludes: ${JSON.stringify(dir)}(repo 相対の src/app/... を末尾 / 無しで書く)`);
      continue;
    }
    if (!isDir(dir)) stale.push(`forkScanExcludes: ${dir}(ディレクトリとして存在しない。削除済みなら行を外す)`);
    if (FORK_SCAN_EXCLUDES.indexOf(dir) !== i) stale.push(`forkScanExcludes: ${dir}(重複)`);
    const outer = scanExcludes.find((ex) => ex !== dir && isUnder(dir, ex));
    if (outer) stale.push(`forkScanExcludes: ${dir}(${outer} で既に除外される。登録不要)`);
  }
  return stale;
}

/**
 * ルート内 loader の一覧(検出した各ルートの _screen/loader.ts と _components/loader.ts のうち存在するもの)。
 * ルートの loader は必ずここに置く(README §4)。管理画面も各ルートに loader.ts を置き、共通の取得は domains/core/admin/services/server/screenParts.ts の組を渡す
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

/**
 * `@/domains/.../components/<a>` が部品を持つセクションコンテナ(index.tsx を持つディレクトリ)か。
 * `@/domains/<d>` は tsconfig paths と同じく core ドメインなら src/domains/core/<d> に解決する
 */
export function isContainerDir(dirSpec) {
  const rest = dirSpec.replace(/^@\/domains\//, "");
  const dir = rest.startsWith("core/") || !isDir(`src/domains/core/${rest.split("/")[0]}`) ? `src/domains/${rest}` : `src/domains/core/${rest}`;
  return exists(`${dir}/index.tsx`);
}

// ---------------------------------------------------------------------------
// テスト本体
// ---------------------------------------------------------------------------

const pages = discoverPages();
const pageByDir = new Map(pages.map((p) => [dirname(p), p]));
const pageDirs = new Set(pageByDir.keys());

for (const page of pages) {
  const dir = dirname(page);
  const { problems, target } = parseSwitchPage(read(page));

  test(`${dir}: page.tsx は Screen への 1 行スイッチ`, () => {
    assert.deepEqual(
      problems,
      [],
      `${page}: ${problems.join(" / ")}\n→ page.tsx を \`export { XScreen as default, generateMetadata } from "./_screen/XScreen"\` にして本体を _screen/ へ移す` +
        `(fork の差し替えは _components/ の Screen へ向ける。未移行の例外リストは無い)`,
    );
  });

  if (problems.length === 0 && target) {
    test(`${dir}: ${target.screenDir}/${target.file} が ${target.name} を named export する Server Component で、features の import は components/<Name> まで`, () => {
      const file = resolveScreenFile(dir, target);
      assert.ok(file, `${dir}/${target.screenDir}/${target.file}(.tsx | /index.tsx) が無い`);
      const source = read(file);
      const screenProblems = [...checkScreenFile(source, target.name), ...checkScreenImports(source, { isContainerDir })];
      assert.deepEqual(screenProblems, [], `${file}: ${screenProblems.join(" / ")}`);
    });
    if (dir === "src/app/admin" || dir.startsWith("src/app/admin/")) {
      test(`${dir}: 管理のページの ${target.name} が AdminPage を描く(ヘッダーの行は AdminPage、全 Tier)`, () => {
        const file = resolveScreenFile(dir, target);
        if (!file) return;
        const adminProblems = checkAdminPageScreen(read(file));
        assert.deepEqual(adminProblems, [], `${file}: ${adminProblems.join(" / ")}`);
      });
    }
    test(`${dir}: ${target.name} の createScreen の load が同じルートの loader(D21・D110)`, () => {
      const file = resolveScreenFile(dir, target);
      if (!file) return;
      const { problems: callProblems } = checkScreenLoaderCall(read(file), target.name);
      assert.deepEqual(callProblems, [], `${file}: ${callProblems.join(" / ")}`);
    });
  }
}

// 枠の layout.tsx: FRAME_LAYOUTS と、./_layout/ を指す re-export を持つ layout.tsx(fork が自分で作ったスイッチも同じ規則)
const layoutFiles = listAppFiles(repoRoot).filter((file) => file.endsWith("/layout.tsx"));
const switchLayouts = layoutFiles.filter(
  (file) => FRAME_LAYOUTS.includes(file) || SWITCH_REEXPORT.test(stripComments(read(file))),
);
for (const layout of switchLayouts) {
  const dir = dirname(layout);
  const { problems, target } = parseSwitchLayout(read(layout));
  test(`${layout}: 枠の layout.tsx は _layout/ の組み立てへの 1 行スイッチ`, () => {
    assert.deepEqual(
      problems,
      [],
      `${layout}: ${problems.join(" / ")}\n→ layout.tsx を \`export { XLayout as default } from "./_layout/XLayout"\` にし、` +
        `fork の差分は slot / config / 丸ごと置き換え(_layout/XLayout.replace.tsx)へ移す`,
    );
  });
  if (problems.length === 0 && target) {
    test(`${layout}: ${target.screenDir}/${target.file} が ${target.name} を named export する`, () => {
      const file = [".tsx", ".ts", "/index.tsx"].map((ext) => `${dir}/${target.screenDir}/${target.file}${ext}`).find(exists);
      assert.ok(file, `${dir}/${target.screenDir}/${target.file}(.tsx | .ts | /index.tsx) が無い`);
      const targetProblems = checkLayoutTarget(read(file), target.name);
      assert.deepEqual(targetProblems, [], `${file}: ${targetProblems.join(" / ")}`);
    });
  }
}

test("スイッチの検出: ./_layout/ への re-export だけを拾い、ガード付き layout.tsx の素の import は拾わない", () => {
  assert.ok(SWITCH_REEXPORT.test(`export { AdminLayout as default } from "./_layout/AdminLayout";`));
  assert.ok(SWITCH_REEXPORT.test(`export { default } from "./_layout/XLayout";`), "形の誤りは検出して parseSwitchLayout で落とす");
  const guarded = `import { redirect } from "next/navigation";\nimport { AdminProtectedLayout } from "./_layout/AdminProtectedLayout";\n` +
    `export default async function L({ children }) {\n  await ${"authGuard"}({});\n  return <AdminProtectedLayout>{children}</AdminProtectedLayout>;\n}`;
  assert.equal(SWITCH_REEXPORT.test(guarded), false);
  for (const file of ["src/app/admin/(protected)/layout.tsx"]) {
    if (exists(file)) assert.equal(switchLayouts.includes(file), false, `${file} はガード付き(スイッチの検査対象外)`);
  }
});

test("FRAME_LAYOUTS: upstream の枠の layout.tsx が検査対象に入っている(Tier1 では全て存在する)", (t) => {
  const missing = FRAME_LAYOUTS.filter((file) => !exists(file));
  if (missing.length > 0 && !isUpstreamRoot) {
    t.skip(`fork で削除されたルート: ${missing.join(", ")}`);
    return;
  }
  assert.deepEqual(missing, []);
  for (const file of FRAME_LAYOUTS) assert.ok(switchLayouts.includes(file), `${file} が検査対象に無い`);
});

const routeLoaders = discoverRouteLoaders(pageDirs);
for (const loader of routeLoaders) {
  test(`${loader}: loader は server-only + cache() か createLoader + load<Xxx>、_components / Screen を import しない`, () => {
    const problems = checkLoaderFile(read(loader), { path: loader });
    assert.deepEqual(problems, [], `${loader}: ${problems.join(" / ")}`);
  });
}

test("forkScanExcludes: 存在しない・重複した・他の除外の中の除外が無い", () => {
  const stale = staleScanEntries();
  assert.deepEqual(stale, [], `src/config/lib/screens.config.ts を更新する:\n${stale.join("\n")}`);
});

// wallet ルートは fork が削除してよい(README §7)ので、ディレクトリがあるときだけ「検出されること」を検査する
const walletDir = "src/app/(user)/(protected)/wallet";
const hasWallet = exists(`${walletDir}/page.tsx`);

test("検出範囲: src/app 全体(wallet(あれば)・管理画面・debug・デモ)が含まれ、生成テンプレートは含まれない", () => {
  if (hasWallet) {
    assert.ok(pageDirs.has(walletDir));
    assert.ok(pageDirs.has(`${walletDir}/[slug]/history`));
  }
  assert.ok(pageDirs.has("src/app/(user)"), "トップページ(_screen/StarterHomeScreen)が検出されていない");
  assert.ok([...pageDirs].some((d) => d.startsWith("src/app/admin/(protected)/")), "生成された管理画面ルートが検出されていない");
  assert.ok(pageDirs.has("src/app/(user)/demo"), "デモ(構造の検査の対象)が検出されていない");
  // 手書きの管理画面(pnpm generate domain 由来でない)も検出し、生成テンプレートは外す
  for (const dir of ["src/app/admin/(protected)", "src/app/admin/login", "src/app/admin/(protected)/users/general"]) {
    assert.ok(pageDirs.has(dir), `${dir} が検出されていない`);
  }
  assert.equal([...pageDirs].some((d) => d.startsWith("src/app/admin/_template")), false);
  // 固定の走査範囲の外だった区域も検出する(M1)
  assert.ok(pageDirs.has("src/app/debug"), "src/app/debug が検出されていない");
  assert.equal([...pageDirs].some((d) => d.startsWith("src/app/api")), false);
});

test("検出範囲: ルート内 loader(wallet 配下 9 件、あれば)と管理画面の loader が検出される", () => {
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
  assert.ok(routeLoaders.includes("src/app/admin/(protected)/_screen/loader.ts"), "管理画面の loader が検出されていない");
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

test("parseSwitchPage: default + generateMetadata の再 export の 1 形。静的な metadata・自前の題名・画面ロジックを弾く(D110)", () => {
  const ok = `
    import type { Viewport } from "next";
    export const maxDuration = 60;
    export const viewport: Viewport = { themeColor: "#000" };
    export { WalletBalanceScreen as default, generateMetadata } from "./_screen/WalletBalanceScreen";
  `;
  assert.deepEqual(parseSwitchPage(ok).problems, []);
  assert.deepEqual(parseSwitchPage(ok).target, { screenDir: "_screen", file: "WalletBalanceScreen", name: "WalletBalanceScreen" });
  assert.deepEqual(checkSwitchPage(ok, "WalletBalanceScreen"), []);

  const replaced = `export { Home as default, generateMetadata } from "./_components/Home";`;
  assert.deepEqual(parseSwitchPage(replaced).problems, []);
  assert.equal(parseSwitchPage(replaced).target.screenDir, "_components");
  assert.ok(checkSwitchPage(replaced, "HomeScreen").length > 0, "期待名を指定したときは _screen の同名であること");

  const noTitle = `export { XScreen as default } from "./_screen/XScreen";`;
  assert.ok(parseSwitchPage(noTitle).problems.some((p) => p.includes("`generateMetadata` が無い")), "generateMetadata は必ず再 export");

  const staticReexport = `export { AdminSampleListScreen as default, generateMetadata, metadata } from "./_screen/AdminSampleListScreen";`;
  assert.ok(parseSwitchPage(staticReexport).problems.some((p) => p.includes("静的な metadata は再 export しない")));

  const ownStatic = `
    import type { Metadata } from "next";
    export const metadata = { title: "x" } satisfies Metadata;
    export { XScreen as default, generateMetadata } from "./_screen/XScreen";
  `;
  assert.deepEqual(parseSwitchPage(ownStatic).problems, ["page.tsx に静的な metadata を書かない(題名は createScreen の metadata へ(値も関数 (data, props) も load = 範囲とページの確かめの後だけ返る)。page.tsx は `export { XScreen as default, generateMetadata } from \"./_screen/XScreen\"`)"]);

  const ownGenerate = `
    import type { Metadata } from "next";
    export async function generateMetadata(): Promise<Metadata> { return { title: "x" }; }
    export { XScreen as default } from "./_screen/XScreen";
  `;
  assert.ok(parseSwitchPage(ownGenerate).problems.some((p) => p.includes("generateMetadata を書かない")));

  const routeLoader = `
    import { loadWalletBalanceScreen } from "./_screen/loader";
    export { WalletBalanceScreen as default, generateMetadata } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(parseSwitchPage(routeLoader).problems.some((p) => p.includes("./_screen/loader")), "ルート内 loader の import は不可(題名は Screen の createScreen)");

  const defaultSpec = `export { default } from "./_screen/XScreen";`;
  assert.ok(parseSwitchPage(defaultSpec).problems.some((p) => p.includes("default export しない")));

  // cacheComponents と両立しない segment config は形の違反(名ごとに 1 件、残りの記述としては二重に出さない)
  const forceDynamic = `
    export const dynamic = "force-dynamic";
    export { AdminSampleListScreen as default, generateMetadata } from "./_screen/AdminSampleListScreen";
  `;
  assert.deepEqual(parseSwitchPage(forceDynamic).problems, [
    "segment config `dynamic` は書かない(cacheComponents と両立しない。lint segment-config/cc-incompatible、消すだけでよい)",
  ]);
  const revalidate = `export const revalidate = 60;\nexport const runtime = "nodejs";\nexport { XScreen as default, generateMetadata } from "./_screen/XScreen";`;
  assert.equal(parseSwitchPage(revalidate).problems.length, 2);
  assert.ok(parseSwitchPage(revalidate).problems.every((p) => p.startsWith("segment config ")));
  const layoutDynamic = `export const dynamic = "force-dynamic";\nexport { XLayout as default } from "./_layout/XLayout";`;
  assert.ok(parseSwitchLayout(layoutDynamic).problems.some((p) => p.includes("segment config `dynamic`")));

  const dynamicReexport = `export { AdminSampleListScreen as default, generateMetadata, dynamic } from "./_screen/AdminSampleListScreen";`;
  assert.ok(parseSwitchPage(dynamicReexport).problems.some((p) => p.includes("dynamic")));

  const jsx = `
    import { UserPage } from "@/app/(user)/_layout/UserPage";
    export default function Page() { return <UserPage />; }
  `;
  assert.ok(parseSwitchPage(jsx).problems.length > 0);

  const navigation = `
    import { notFound } from "next/navigation";
    export { WalletBalanceScreen as default, generateMetadata } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(parseSwitchPage(navigation).problems.some((p) => p.includes("next/navigation")));

  const sectionContainer = `
    import { WalletBalance } from "@/domains/core/wallet/components/WalletBalance";
    export { WalletBalanceScreen as default, generateMetadata } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(parseSwitchPage(sectionContainer).problems.some((p) => p.includes("components/WalletBalance")));
});

test("checkScreenImports: index.tsx を持つコンテナの内側(部品)は弾き、グループ分けのディレクトリは名前空間として通す", () => {
  const ok = `
    import { WalletBalance } from "@/domains/core/wallet/components/WalletBalance";
    import { Signup } from "@/domains/auth/components/Signup";
    import { AdminSampleList } from "@/domains/sample/components/AdminSampleList/index";
    import { UserPage } from "@/app/(user)/_layout/UserPage";
    import { loadXScreen } from "./loader";
    import { Part } from "./Part";
  `;
  assert.deepEqual(checkScreenImports(ok), []);
  // 述語を省略すると入れ子は全て違反(厳しい側)
  assert.ok(checkScreenImports(`export { X } from "@/domains/core/x/components/Y/Z";`).length === 1);

  const containers = new Set(["@/domains/core/wallet/components/WalletBalance", "@/domains/shop/components/Admin/OrderList"]);
  const opts = { isContainerDir: (d) => containers.has(d) };
  assert.ok(checkScreenImports(`import { BalanceCard } from "@/domains/core/wallet/components/WalletBalance/BalanceCard";`, opts).length === 1);
  assert.ok(checkScreenImports(`import { Row } from "@/domains/shop/components/Admin/OrderList/Row";`, opts).length === 1, "グループ内のコンテナの部品も弾く");
  const grouped = `
    import { OrderList } from "@/domains/shop/components/Admin/OrderList";
    import { OrderList as L } from "@/domains/shop/components/Admin/OrderList/index";
    import { GachaList } from "@/domains/shop/components/common/GachaList";
    import { Picker } from "@/domains/shop/components/Mobile/sub/Picker";
  `;
  assert.deepEqual(checkScreenImports(grouped, opts), []);
});

test("isContainerDir: index.tsx を持つディレクトリだけをコンテナとみなす(core の別名を解決、index.ts だけの barrel は名前空間)", () => {
  assert.equal(isContainerDir("@/domains/auth/components/Signup"), true);
  assert.equal(isContainerDir("@/domains/core/auth/components/Signup"), true);
  assert.equal(isContainerDir("@/domains/user/components/admin"), false);
  assert.equal(isContainerDir("@/domains/userProfile/components/common"), false, "common/index.ts は barrel");
  assert.equal(isContainerDir("@/domains/no-such-domain/components/X"), false);
});

test("checkScreenFile: createScreen の呼び出しの export だけ。関数の Screen・静的な metadata・default export・\"use client\" を弾く(D110)", () => {
  const ok = `import { createScreen } from "@/wiring/screen";\nimport { loadXScreen } from "./loader";\nexport const { Screen: XScreen, generateMetadata } = createScreen({\n  load: loadXScreen,\n  render: (data) => <p>{"it's"}{data.a}</p>,\n  metadata: { title: "x" },\n});\n`;
  assert.deepEqual(checkScreenFile(ok, "XScreen"), []);
  const old = `import { loadXScreen } from "./loader";\nexport const metadata = { title: "x" };\nexport async function XScreen(props) { const d = await loadXScreen(props); return null; }`;
  const oldProblems = checkScreenFile(old, "XScreen");
  assert.ok(oldProblems.some((p) => p.includes("createScreen を @/wiring/screen から import していない")), oldProblems.join(" / "));
  assert.ok(oldProblems.some((p) => p.includes("関数で書かない")));
  assert.ok(oldProblems.some((p) => p.includes("静的な metadata")));
  const libMaker = ok.replace("@/wiring/screen", "@/lib/screens");
  assert.ok(checkScreenFile(libMaker, "XScreen").some((p) => p.includes("@/wiring/screen")), "lib の汎用版を画面が直に読むのは不可");
  const wrongName = ok.replace("Screen: XScreen", "Screen: YScreen");
  assert.ok(checkScreenFile(wrongName, "XScreen").some((p) => p.includes("{ Screen: XScreen, generateMetadata }")));
  const noTitle = ok.replace("Screen: XScreen, generateMetadata", "Screen: XScreen");
  assert.ok(checkScreenFile(noTitle, "XScreen").length > 0, "generateMetadata も受ける");
  assert.ok(checkScreenFile(`${ok}export default XScreen;`, "XScreen").some((p) => p.includes("default export")));
  assert.ok(checkScreenFile(`"use client";\n${ok}`, "XScreen").some((p) => p.includes("use client")));
});

test("例外リストの鮮度: _components への差し替えは移行済み扱いにしない(fork で upstream の一覧が落ちない)", () => {
  // tradelaw は upstream の未移行ルート。fork が ./_components/ に差し替えた状態を想定して判定だけ確認する
  const forkReplaced = `export { Tradelaw as default, generateMetadata } from "./_components/Tradelaw";`;
  const { problems, target } = parseSwitchPage(forkReplaced);
  assert.deepEqual(problems, []);
  assert.equal(target.screenDir, "_components");
  const upstreamMigrated = `export { TradelawScreen as default, generateMetadata } from "./_screen/TradelawScreen";`;
  assert.equal(parseSwitchPage(upstreamMigrated).target.screenDir, "_screen");
});

test("checkLoaderFile: createLoader 製(Factory が cache を張る)も cache() 直書きも通る。void loader も純粋な解釈だけの loader も cache() か createLoader は必須", () => {
  const good = `import "server-only";\nimport { cache } from "react";\nconst r = cache(async () => 1);\nexport async function loadAdminHomeScreen() { return r(); }`;
  assert.deepEqual(checkLoaderFile(good), []);
  const factory = `import "server-only";\nimport { createLoader } from "@/app/admin/(protected)/guard";\nimport { adminListParts } from "@/domains/core/admin/services/server/screenParts";\nexport const loadAdminSampleListScreen = createLoader(adminListParts("sample"));`;
  assert.deepEqual(checkLoaderFile(factory), []);
  const voidLoader = `import "server-only";\nimport { cache } from "react";\nimport { redirect } from "next/navigation";\nexport const loadFriendCouponScreen = cache(async (): Promise<void> => { if (!enabled()) redirect("/mypage"); });`;
  assert.deepEqual(checkLoaderFile(voidLoader), []);
  const noCache = `import "server-only";\nexport async function loadItemListScreen(props) { const { status } = await props.params; return { status }; }`;
  assert.ok(checkLoaderFile(noCache).some((p) => p.includes("cache()")));
  const bad = `import { cache } from "react";\nexport const helper = 1;`;
  assert.ok(checkLoaderFile(bad).length >= 2);
});

test("checkLoaderFile: shell: true は DB・保管庫・request を読まない load だけ(import・key・getUser / allows を名指す)", () => {
  const base = `import "server-only";\nimport { createLoader } from "@/app/guard";\n`;
  const ok = `${base}import { gate } from "@/featureGate";\nexport const loadDemoIndexScreen = createLoader({ access: "public", shell: true, load: async () => ({ pages: gate.filter([]) }) });`;
  assert.deepEqual(checkLoaderFile(ok), []);
  const typeOnly = `${base}import type { Setting } from "@/domains/core/setting/services/server/settingService";\nexport const loadX = createLoader({ access: "public", shell: true, load: async (): Promise<Setting | null> => null });`;
  assert.deepEqual(checkLoaderFile(typeOnly), []);
  const db = `${base}import { sampleService } from "@/domains/sample/services/server/sampleService";\nexport const loadX = createLoader({ access: "public", shell: true, load: async () => sampleService.list() });`;
  assert.ok(checkLoaderFile(db).some((p) => p.includes("services/server")));
  const storage = `${base}import { getLatestManifest } from "@/lib/storage/server";\nexport const loadX = createLoader({ access: "public", shell: true, load: async () => getLatestManifest() });`;
  assert.ok(checkLoaderFile(storage).some((p) => p.includes("@/lib/storage")));
  const keyed = `${base}export const loadX = createLoader({ access: "public", shell: true, key: async (props) => [(await props.searchParams).q], load: async (_c, q) => q });`;
  assert.ok(checkLoaderFile(keyed).some((p) => p.includes("key")));
  const user = `${base}export const loadX = createLoader({ access: "public", shell: true, load: async ({ getUser }) => getUser() });`;
  assert.ok(checkLoaderFile(user).some((p) => p.includes("getUser")));
  // 宣言の無い loader は見ない(既定の request 時)
  const plain = `${base}import { sampleService } from "@/domains/sample/services/server/sampleService";\nexport const loadX = createLoader({ access: "public", load: async () => sampleService.list() });`;
  assert.deepEqual(checkLoaderFile(plain), []);
});

test("checkLoaderFile: DTO 型は loader が所有する(_components / Screen からの import は type でも不可)", () => {
  const base = `import "server-only";\nimport { cache } from "react";\n`;
  const ok = `${base}import type { ScreenProps } from "@/lib/screens";\nimport { userService } from "@/domains/core/user/services/server/userService";\nexport type WinReportScreenData = { reports: string[] };\nexport const loadWinReportScreen = cache(async () => ({ reports: [] }));`;
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
  const typesFile = `${base}import type { WalletIndexScreen } from "@/domains/core/wallet/types/WalletIndexScreen";\nexport const loadWalletIndexScreen = cache(async (): Promise<WalletIndexScreen> => ({}));`;
  assert.deepEqual(checkLoaderFile(typesFile), []);
  const dirScreen = `${base}import type { Props } from "../_screen/WinReportScreen/index";\nexport const loadWinReportScreen = cache(async (): Promise<Props> => ({}));`;
  assert.ok(checkLoaderFile(dirScreen).some((p) => p.includes("WinReportScreen")));
  assert.deepEqual(checkLoaderFile(ok, null), [], "options に null を渡しても落ちない");
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

// upstream は _screen/・_layout/ に点つきの名前のファイルを作らない(報告書 §2 W: 点つきの名前 = fork の置き換え .replace)。
// fork はそこへ自分の置き換えを置く側なので、Tier1(src/lib/CATALOG.md の先頭節の持ち主 = 自分)でだけ検査する。
// 判定は eslint.config.mjs の fork 所有ライブラリと同じ isRoot(origin が分からないときは skip = 検査しない)。
const isUpstreamRoot = loadCatalogOwnership({ repoRoot, folder: "src/lib" }).isRoot;
test(
  "upstream は _screen/・_layout/ に点つきの名前のファイルを作らない(Tier1 のみ)",
  { skip: isUpstreamRoot ? false : "fork(Tier1 以外)では丸ごと置き換え .replace を置くので検査しない" },
  () => {
    assert.deepEqual(findDotNamedFiles(listAppFiles(repoRoot)), []);
  },
);

// _screen/・_layout/ の隣に許す点つきの名前は .replace(と .test)だけ。旧い fork の名前の印は全 Tier で止める
test("_screen/・_layout/ の点つきの名前は .replace だけ(旧い fork の印は移し方: 共有の棚の印の移行の notice)", () => {
  assert.deepEqual(findMarkerNamedFiles(listAppFiles(repoRoot)), []);
});

test("_screen/・_layout/ の .replace は置き換える既定を持つ(孤立・既定の無い所の .replace は不可、全 Tier。pnpm check extensions も回す)", () => {
  const files = listAppFiles(repoRoot);
  assert.deepEqual(findRouteReplaceProblems(files, (f) => readFileSync(join(repoRoot, f), "utf8")), []);
});

test("findRouteReplaceProblems: スイッチの向け先と .default の隣は通り、隣に名前があるだけの部品の .replace は no-default、隣に何も無いのは orphan", () => {
  const texts = {
    "src/app/(user)/layout.tsx": 'export { UserLayout as default } from "./_layout/UserLayout.replace";\n',
    "src/app/(user)/w/page.tsx": 'export { WScreen as default } from "./_screen/WScreen";\n',
  };
  const files = [
    ...Object.keys(texts),
    "src/app/(user)/_layout/UserLayout.tsx",
    "src/app/(user)/_layout/UserLayout.replace.tsx",
    "src/app/(user)/_layout/Header/index.tsx",
    "src/app/(user)/_layout/Header/index.replace.tsx",
    "src/app/(user)/_layout/BottomNav/BottomNavItem.tsx",
    "src/app/(user)/_layout/BottomNav/BottomNavItem.replace.tsx",
    "src/app/(user)/_layout/AdminHeader.default.tsx",
    "src/app/(user)/_layout/AdminHeader.tsx",
    "src/app/(user)/_layout/AdminHeader.replace.tsx",
    "src/app/(user)/_layout/Gone.replace.tsx",
    "src/app/(user)/w/_screen/WScreen.tsx",
  ];
  assert.deepEqual(findRouteReplaceProblems(files, (f) => texts[f] ?? null), [
    { path: "src/app/(user)/_layout/BottomNav/BottomNavItem.replace.tsx", reason: "no-default" },
    { path: "src/app/(user)/_layout/Gone.replace.tsx", reason: "orphan" },
    { path: "src/app/(user)/_layout/Header/index.replace.tsx", reason: "no-default" },
  ]);
});

test("findRouteReplaceProblems: _screen/ の下の .replace は向け先でも .default の隣でも孤立でも in-screen、_layout/ の .replace は通る", () => {
  const texts = {
    "src/app/(user)/layout.tsx": 'export { UserLayout as default } from "./_layout/UserLayout.replace";\n',
    "src/app/(user)/w/page.tsx": 'export { WScreen as default, generateMetadata } from "./_screen/WScreen.replace";\n',
  };
  const files = [
    ...Object.keys(texts),
    "src/app/(user)/_layout/UserLayout.tsx",
    "src/app/(user)/_layout/UserLayout.replace.tsx",
    "src/app/(user)/_layout/AdminHeader.default.tsx",
    "src/app/(user)/_layout/AdminHeader.tsx",
    "src/app/(user)/_layout/AdminHeader.replace.tsx",
    "src/app/(user)/w/_screen/WScreen.tsx",
    "src/app/(user)/w/_screen/WScreen.replace.tsx",
    "src/app/(user)/w/_screen/Part.default.tsx",
    "src/app/(user)/w/_screen/Part.tsx",
    "src/app/(user)/w/_screen/Part.replace.tsx",
    "src/app/(user)/w/_screen/sub/Row.tsx",
    "src/app/(user)/w/_screen/sub/Row.replace.tsx",
    "src/app/(user)/w/_screen/Gone.replace.tsx",
  ];
  assert.deepEqual(findRouteReplaceProblems(files, (f) => texts[f] ?? null), [
    { path: "src/app/(user)/w/_screen/Gone.replace.tsx", reason: "in-screen" },
    { path: "src/app/(user)/w/_screen/Part.replace.tsx", reason: "in-screen" },
    { path: "src/app/(user)/w/_screen/WScreen.replace.tsx", reason: "in-screen" },
    { path: "src/app/(user)/w/_screen/sub/Row.replace.tsx", reason: "in-screen" },
  ]);
});

test("describeRouteReplaceProblem: in-screen は <ルート>/_components/<X>Screen.tsx と page.tsx のスイッチを案内する", () => {
  const message = describeRouteReplaceProblem({ path: "src/app/(user)/w/_screen/WScreen.replace.tsx", reason: "in-screen" });
  assert.match(message, /src\/app\/\(user\)\/w\/_components\/WScreen\.tsx/);
  assert.match(message, /src\/app\/\(user\)\/w\/page\.tsx の 1 行スイッチを \.\/_components\/WScreen に向け/);
  assert.match(describeRouteReplaceProblem({ path: "src/app/(user)/_layout/Gone.replace.tsx", reason: "orphan" }), /孤立した \.replace/);
  assert.match(describeRouteReplaceProblem({ path: "src/app/(user)/_layout/X/index.replace.tsx", reason: "no-default" }), /置き換えの口でない部品/);
});

test("findOrphanReplaceFiles: 隣に <名前>.ts(x) か <名前>/index.ts(x) の無い .replace だけを拾う", () => {
  const files = [
    "src/app/(user)/_layout/UserLayout.tsx",
    "src/app/(user)/_layout/UserLayout.replace.tsx",
    "src/app/(user)/_layout/Header/index.tsx",
    "src/app/(user)/_layout/Header.replace.tsx",
    "src/app/(user)/_layout/Header/index.replace.tsx",
    "src/app/(user)/_layout/Gone.replace.tsx",
    "src/app/(user)/w/_screen/WScreen.replace.tsx",
    "src/app/(user)/w/_components/X.replace.tsx",
  ];
  assert.deepEqual(findOrphanReplaceFiles(files), ["src/app/(user)/_layout/Gone.replace.tsx", "src/app/(user)/w/_screen/WScreen.replace.tsx"]);
});

// upstream は src/app に _components/ を持たない(`_components/` = fork 所有。upstream の既定は _screen/・_layout/)。
// fork はそこへ自分の画面・部品を置く側なので、上と同じく Tier1 でだけ検査する。
test(
  "upstream は src/app に _components/ のファイルを持たない(Tier1 のみ)",
  { skip: isUpstreamRoot ? false : "fork(Tier1 以外)では _components/ に自分の画面・部品を置くので検査しない" },
  () => {
    assert.deepEqual(findForkOwnedDirFiles(listAppFiles(repoRoot)), []);
  },
);

test("findForkOwnedDirFiles: src/app 配下の _components/ のファイルだけを拾う", () => {
  const files = [
    "src/app/(user)/wallet/_components/WalletScreen.tsx",
    "src/app/(user)/wallet/_components/parts/Row.tsx",
    "src/app/(user)/wallet/_screen/WalletScreen.tsx",
    "src/app/(user)/wallet/page.tsx",
    "src/app/admin/(protected)/users/_components/loader.ts",
    "src/domains/foo/_components/Bar.tsx",
    "src/app/(user)/my_components/X.tsx",
  ];
  assert.deepEqual(findForkOwnedDirFiles(files), [
    "src/app/(user)/wallet/_components/WalletScreen.tsx",
    "src/app/(user)/wallet/_components/parts/Row.tsx",
    "src/app/admin/(protected)/users/_components/loader.ts",
  ]);
});

test("findDotNamedFiles = fork の置き換えの印(.replace・.override)だけ。findMarkerNamedFiles = 許さない点つきの名前(旧い印・.override・枠の外の config.ui)", () => {
  const files = [
    "src/app/(user)/_layout/UserLayout.tsx",
    "src/app/(user)/_layout/config.ui.ts",
    "src/app/(user)/_layout/Header/config.ui.tsx",
    "src/app/(user)/_layout/Header/config.ui.ts",
    "src/app/(user)/_layout/UserLayout.replace.tsx",
    "src/app/(user)/_layout/UserLayout.test.tsx",
    "src/app/(user)/_layout/Header/index.acme.tsx",
    "src/app/(user)/_layout/userMenu.override.ts",
    "src/app/admin/_layout/AdminHeader.default.tsx",
    "src/app/admin/_layout/AdminHeader.tsx",
    "src/app/admin/_layout/AdminHeader.replace.tsx",
    "src/app/(user)/_layout/hooks/useHeaderData.ts",
    "src/app/admin/(protected)/_layout/guard.ts",
    "src/app/(user)/wallet/_screen/WalletScreen.tsx",
    "src/app/(user)/wallet/_screen/WalletScreen.replace.tsx",
    "src/app/(user)/wallet/_components/WalletScreen.acme.tsx",
    "src/app/(user)/wallet/page.tsx",
    "src/app/route-map.jsonl",
  ];
  assert.deepEqual(
    findDotNamedFiles(files),
    [
      "src/app/(user)/_layout/UserLayout.replace.tsx",
      "src/app/(user)/_layout/userMenu.override.ts",
      "src/app/admin/_layout/AdminHeader.replace.tsx",
      "src/app/(user)/wallet/_screen/WalletScreen.replace.tsx",
    ],
    "印だけ: config.ui.ts・.default・テスト・旧い印は返さない(設定 D101)",
  );
  assert.deepEqual(findOrphanReplaceFiles(files), [], "AdminHeader.replace は隣のスイッチ AdminHeader.tsx を置き換える");
  assert.deepEqual(
    findMarkerNamedFiles(files),
    [
      "src/app/(user)/_layout/Header/config.ui.tsx",
      "src/app/(user)/_layout/Header/config.ui.ts",
      "src/app/(user)/_layout/Header/index.acme.tsx",
      "src/app/(user)/_layout/userMenu.override.ts",
    ],
    "許すのは枠の _layout/ の直下の描画用の設定 config.ui.ts(地区の UI_CONFIG_FILE)だけ。下のフォルダの config.ui は印",
  );
});

test("parseSwitchLayout: ./_layout/ への 1 行スイッチだけを許し、JSX 直書き・_screen 向き・複数の re-export を弾く", () => {
  const ok = `export { UserLayout as default } from "./_layout/UserLayout";\n`;
  assert.deepEqual(parseSwitchLayout(ok).problems, []);
  assert.deepEqual(parseSwitchLayout(ok).target, { screenDir: "_layout", file: "UserLayout", name: "UserLayout" });
  const replaced = `// fork の丸ごと置き換えへ\nexport { AcmeUserLayout as default } from "./_layout/UserLayout.replace";\n`;
  assert.deepEqual(parseSwitchLayout(replaced).problems, []);
  assert.deepEqual(parseSwitchLayout(replaced).target, { screenDir: "_layout", file: "UserLayout.replace", name: "AcmeUserLayout" });
  assert.match(parseSwitchLayout(`export { L as default } from "./_layout/UserLayout.acme";`).problems.join(), /既定の <X> か丸ごと置き換えの <X>\.replace だけ/);
  assert.deepEqual(parseSwitchPage(`export { WScreen as default, generateMetadata } from "./_screen/WScreen.replace";`).problems, []);
  assert.deepEqual(parseSwitchPage(`export { WScreen as default, generateMetadata } from "./_components/WScreen";`).problems, []);
  assert.match(parseSwitchPage(`export { WScreen as default } from "./_components/WScreen.custom";`).problems.join(), /\.replace だけ/);
  assert.match(parseSwitchPage(`export { WScreen as default } from "./_screen/WScreen.default";`).problems.join(), /\.replace だけ/);
  const withMetadata = `import type { Metadata } from "next";\nexport const metadata: Metadata = { title: "x" };\nexport { XLayout as default } from "./_layout/XLayout";`;
  assert.deepEqual(parseSwitchLayout(withMetadata).problems, []);
  const jsx = `import type { ReactNode } from "react";\nimport { UserLayout } from "@/app/(user)/_layout/UserLayout";\nexport default function L({ children }: { children: ReactNode }) {\n  return <UserLayout>{children}</UserLayout>;\n}`;
  assert.ok(parseSwitchLayout(jsx).problems.length > 0);
  assert.ok(parseSwitchLayout(`export { XScreen as default } from "./_screen/XScreen";`).problems.length > 0, "layout は _screen を指さない");
  assert.ok(parseSwitchLayout(`${ok}export { YLayout } from "./_layout/YLayout";`).problems.length > 0);
  assert.ok(parseSwitchLayout(`export { default } from "./_layout/XLayout";`).problems.some((p) => p.includes("default export しない")));
});

test("checkLayoutTarget: named export を要求し、default export を弾き、\"use client\" は許す", () => {
  assert.deepEqual(checkLayoutTarget(`"use client";\nexport function UserLayout() { return null; }`, "UserLayout"), []);
  assert.deepEqual(checkLayoutTarget(`export const MyPageLayout = () => null;`, "MyPageLayout"), []);
  assert.ok(checkLayoutTarget(`export function Other() { return null; }`, "UserLayout").length > 0);
  assert.ok(checkLayoutTarget(`export function UserLayout() { return null; }\nexport default UserLayout;`, "UserLayout").length > 0);
});

test("checkScreenLoaderCall(D21・D110): createScreen の load が同じルートの loader。差し替え Screen は ../_screen/loader も可", () => {
  const make = (imp, load, name = "XScreen") =>
    `import { createScreen } from "@/wiring/screen";\nimport { loadXScreen } from "${imp}";\nexport const { Screen: ${name}, generateMetadata } = createScreen({\n  load: ${load},\n  render: (data, props) => <p title={"it's"}>{data.a}</p>,\n});\n`;
  assert.deepEqual(checkScreenLoaderCall(make("./loader", "loadXScreen"), "XScreen"), { problems: [], loaderName: "loadXScreen", loaderImport: "./loader" });
  assert.deepEqual(checkScreenLoaderCall(make("../_screen/loader", "loadXScreen", "AcmeXScreen"), "AcmeXScreen").problems, []);
  const none = `import { createScreen } from "@/wiring/screen";\nexport const { Screen: XScreen, generateMetadata } = createScreen({ load: async () => 1, render: () => null });`;
  assert.ok(checkScreenLoaderCall(none, "XScreen").problems[0].includes("import していない"));
  assert.ok(checkScreenLoaderCall(make("./loader", "(props) => loadXScreen(props)"), "XScreen").problems[0].includes("load: loadXScreen"), "包む関数は不可");
  assert.ok(checkScreenLoaderCall(make("./loader", "loadYScreen"), "XScreen").problems[0].includes("同じルートの loader"), "取り違え");
  const nested = `import { createScreen } from "@/wiring/screen";\nimport { loadXScreen } from "./loader";\nexport const { Screen: XScreen, generateMetadata } = createScreen({\n  load: async () => ({}),\n  render: () => <W x={{ load: loadXScreen }} />,\n});\n`;
  assert.ok(checkScreenLoaderCall(nested, "XScreen").problems[0].includes("同じルートの loader"), "入れ子の load: は数えない");
  const notFirst = `import { createScreen } from "@/wiring/screen";\nimport { loadXScreen } from "./loader";\nexport const { Screen: XScreen, generateMetadata } = createScreen({\n  render: () => null,\n  load: loadXScreen,\n});\n`;
  assert.ok(checkScreenLoaderCall(notFirst, "XScreen").problems[0].includes("最初の項目"), "load は設定の最初");
  const jsxText = make("./loader", "loadXScreen").replace(`<p title={"it's"}>{data.a}</p>`, "<p>it's /debug/** {data.a}</p>");
  assert.deepEqual(checkScreenLoaderCall(jsxText, "XScreen").problems, [], "render の JSX のテキストの引用符・/** で読みがずれない");
  const old = `import { loadXScreen } from "./loader";\nexport async function XScreen(props) {\n  const data = await loadXScreen(props);\n  return null;\n}`;
  assert.ok(checkScreenLoaderCall(old, "XScreen").problems[0].includes("createScreen の呼び出しが読めない"), "古い形は受けない");
  assert.ok(checkScreenLoaderCall(make("@/app/y/_screen/loader", "loadXScreen"), "XScreen").problems.length > 0, "別ルートの loader は不可");
});
