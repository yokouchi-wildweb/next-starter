// page 層(page.tsx スイッチ + Screen + loader)の規律テスト。
// 実行: pnpm test:screens (node:test + tsx。registry の .ts を読むため tsx ランナーを使う)
//
// 登録は不要。検査対象は自動検出する(M1):
//   - src/app 全体のページ(./routeTree.mjs の discoverRoutes。`_` で始まるフォルダと src/app/api を除く、@slot は含む)から、
//     SCAN_EXCLUDES と fork の FORK_SCAN_EXCLUDES(src/config/app/screens.config.ts)の配下を除いたもの
//     (除外は構造の検査だけ。ルート地図 src/app/route-map.jsonl には除外したページも載る)
//   - 検出した各ルートの _screen/loader.ts と _components/loader.ts(ルート内 loader)
//
// 守りたい契約(設計: src/lib/screens/README.md):
// 1. page.tsx は「./_screen/<X> または ./_components/<X> からの 1 行 re-export」+ 任意のページ設定
//    (metadata / dynamic 等の export、generateMetadata、それらに必要な import)だけ。画面ロジックを page.tsx に置かない
// 2. 参照先の Screen が存在し、その名前を named export していて、default export も "use client" も持たない
// 3. loader は `import "server-only"` と、最寄りの guard.ts の createLoader(Factory が cache を張る)か React の cache() を使い load<Xxx> を export する
// 4. 未移行の例外リストは無い(upstream も fork も全ページがスイッチ形、D30 K11)。スイッチでない page.tsx は失敗
// 5. 枠を描く layout.tsx(FRAME_LAYOUTS)と ./_layout/ を指す re-export を持つ layout.tsx は page.tsx と同じ 1 行スイッチ形
//    (参照先は ./_layout/<X>、採用者所有・write-once)。全 Tier で検査する。ガード付きの layout.tsx が ./_layout/ の枠を
//    素の import で描くのはスイッチではない(提供者所有、検査対象外)
//
// 検査関数の本体は ./checks.mjs(副作用なし)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// fork の merge で export が欠けても import 時に落ちず、鮮度テストが指摘できるよう namespace import にする
import * as registry from "../../config/app/screens.config.ts";
import {
  ROUTE_LOADER_FILE,
  SCREEN_DIRS,
  barrelTarget,
  checkScreenLoaderCall,
  checkLoaderFile,
  checkScreenFile,
  checkScreenImports,
  checkLayoutTarget,
  checkSwitchPage,
  findDotNamedFiles,
  findForkOwnedDirFiles,
  isReexportOnlyFile,
  parseSwitchLayout,
  parseSwitchPage,
  stripComments,
} from "./checks.mjs";
import { discoverRoutes, listAppFiles } from "./routeTree.mjs";
import { loadCatalogOwnership } from "../folderCatalog/catalog.mjs";

export { checkLoaderFile, checkScreenFile, checkScreenImports, checkSwitchPage, isReexportOnlyFile, parseSwitchPage, stripComments };

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FORK_SCAN_ROOTS = registry.FORK_SCAN_ROOTS ?? [];
const FORK_SCAN_EXCLUDES = registry.FORK_SCAN_EXCLUDES ?? [];
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");
const exists = (path) => existsSync(resolve(repoRoot, path));

/**
 * upstream の枠を描く layout.tsx(1 行スイッチ形であること。ファイルが無ければ = fork がルートを消した → 検査しない)。
 * ガードと同居する admin/(protected)・insane の layout.tsx は提供者所有のまま(報告書 §7)なので載せない
 */
export const FRAME_LAYOUTS = [
  "src/app/(user)/layout.tsx",
  "src/app/(user)/(protected)/mypage/layout.tsx",
  "src/app/admin/layout.tsx",
];

/** スイッチの印 = ./_layout/ を指す re-export(`export { X as default } from "./_layout/X"`)。素の import はガード付き layout の枠の描画 */
const SWITCH_REEXPORT = /export\s*\{[^}]*\}\s*from\s*["']\.\/_layout\//;

// ---------------------------------------------------------------------------
// 検出
// ---------------------------------------------------------------------------

/**
 * 構造の検査から外すディレクトリとその配下(repo 相対)。upstream は空(デモも 1 行スイッチ + _screen/ + loader の形)。
 * fork は registry の FORK_SCAN_EXCLUDES で足す。ルート地図からは外さない(認可の一覧に例外を作らない)
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
 * FORK_SCAN_ROOTS / FORK_SCAN_EXCLUDES の鮮度。
 * FORK_SCAN_ROOTS は src/app 全体の走査(M1)で不要になったので、行が残っていれば外すよう指摘する(export は互換のため残す)。
 * FORK_SCAN_EXCLUDES は形式違い(文字列でない・src/app/ 始まりでない・末尾 /)、存在しないディレクトリ(ファイルも不可)、
 * 重複、他の除外の中にある登録を返す
 */
export function staleScanEntries() {
  const stale = [];
  for (const dir of FORK_SCAN_ROOTS) {
    stale.push(`FORK_SCAN_ROOTS: ${JSON.stringify(dir)}(src/app 全体を走査するようになったので登録不要。行を外す)`);
  }
  for (const [i, dir] of FORK_SCAN_EXCLUDES.entries()) {
    if (typeof dir !== "string" || !dir.startsWith("src/app/") || dir.endsWith("/")) {
      stale.push(`FORK_SCAN_EXCLUDES: ${JSON.stringify(dir)}(repo 相対の src/app/... を末尾 / 無しで書く)`);
      continue;
    }
    if (!isDir(dir)) stale.push(`FORK_SCAN_EXCLUDES: ${dir}(ディレクトリとして存在しない。削除済みなら行を外す)`);
    if (FORK_SCAN_EXCLUDES.indexOf(dir) !== i) stale.push(`FORK_SCAN_EXCLUDES: ${dir}(重複)`);
    const outer = scanExcludes.find((ex) => ex !== dir && isUnder(dir, ex));
    if (outer) stale.push(`FORK_SCAN_EXCLUDES: ${dir}(${outer} で既に除外される。登録不要)`);
  }
  return stale;
}

/**
 * ルート内 loader の一覧(検出した各ルートの _screen/loader.ts と _components/loader.ts のうち存在するもの)。
 * ルートの loader は必ずここに置く(README §4)。管理画面も各ルートに loader.ts を置き、共通の取得は wiring/domains.ts の組を渡す
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
 * `@/features/.../components/<a>` が部品を持つセクションコンテナ(index.tsx を持つディレクトリ)か。
 * `@/features/<d>` は tsconfig paths と同じく core ドメインなら src/features/core/<d> に解決する
 */
export function isContainerDir(dirSpec) {
  const rest = dirSpec.replace(/^@\/features\//, "");
  const dir = rest.startsWith("core/") || !isDir(`src/features/core/${rest.split("/")[0]}`) ? `src/features/${rest}` : `src/features/core/${rest}`;
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
      `${page}: ${problems.join(" / ")}\n→ page.tsx を \`export { XScreen as default } from "./_screen/XScreen"\` にして本体を _screen/ へ移す` +
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
    test(`${dir}: ${target.name} が同じルートの loader を import し本体の最上位で await する(D21)`, () => {
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
        `fork の差分は slot / config / ドット区切り名のカスタム(_layout/XLayout.<project>.tsx)へ移す`,
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
    `export default async function L({ children }) {\n  await authGuard({});\n  return <AdminProtectedLayout>{children}</AdminProtectedLayout>;\n}`;
  assert.equal(SWITCH_REEXPORT.test(guarded), false);
  for (const file of ["src/app/admin/(protected)/layout.tsx", "src/app/admin/insane/layout.tsx"]) {
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

test("FORK_SCAN_ROOTS / FORK_SCAN_EXCLUDES: 不要になった FORK_SCAN_ROOTS の行・存在しない・重複した除外が無い", () => {
  const stale = staleScanEntries();
  assert.deepEqual(stale, [], `src/config/app/screens.config.ts を更新する:\n${stale.join("\n")}`);
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
  // 手書きの管理画面(dc:generate 由来でない)と管理画面のデモも検出し、生成テンプレートは外す
  for (const dir of ["src/app/admin/(protected)", "src/app/admin/login", "src/app/admin/(protected)/users/general"]) {
    assert.ok(pageDirs.has(dir), `${dir} が検出されていない`);
  }
  assert.ok(pageDirs.has("src/app/admin/(protected)/tabs-demo/overview"), "管理画面のデモが検出されていない");
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

test("parseSwitchPage: _screen / _components / metadata re-export を許可し、画面ロジックを弾く", () => {
  const ok = `
    import type { Metadata } from "next";
    import { createMetadata } from "@/lib/metadata";
    import { loadWalletBalanceScreen, type WalletBalanceScreenParams } from "./_screen/loader";
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
    import { UserPage } from "@/app/(user)/_layout/UserPage";
    export default function Page() { return <UserPage />; }
  `;
  assert.ok(parseSwitchPage(jsx).problems.length > 0);

  const navigation = `
    import { notFound } from "next/navigation";
    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(parseSwitchPage(navigation).problems.some((p) => p.includes("next/navigation")));

  const sectionContainer = `
    import { WalletBalance } from "@/features/core/wallet/components/WalletBalance";
    export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
  `;
  assert.ok(parseSwitchPage(sectionContainer).problems.some((p) => p.includes("components/WalletBalance")));

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

test("checkScreenImports: index.tsx を持つコンテナの内側(部品)は弾き、グループ分けのディレクトリは名前空間として通す", () => {
  const ok = `
    import { WalletBalance } from "@/features/core/wallet/components/WalletBalance";
    import { Signup } from "@/features/auth/components/Signup";
    import { AdminSampleList } from "@/features/sample/components/AdminSampleList/index";
    import { UserPage } from "@/app/(user)/_layout/UserPage";
    import { loadXScreen } from "./loader";
    import { Part } from "./Part";
  `;
  assert.deepEqual(checkScreenImports(ok), []);
  // 述語を省略すると入れ子は全て違反(厳しい側)
  assert.ok(checkScreenImports(`export { X } from "@/features/core/x/components/Y/Z";`).length === 1);

  const containers = new Set(["@/features/core/wallet/components/WalletBalance", "@/features/shop/components/Admin/OrderList"]);
  const opts = { isContainerDir: (d) => containers.has(d) };
  assert.ok(checkScreenImports(`import { BalanceCard } from "@/features/core/wallet/components/WalletBalance/BalanceCard";`, opts).length === 1);
  assert.ok(checkScreenImports(`import { Row } from "@/features/shop/components/Admin/OrderList/Row";`, opts).length === 1, "グループ内のコンテナの部品も弾く");
  const grouped = `
    import { OrderList } from "@/features/shop/components/Admin/OrderList";
    import { OrderList as L } from "@/features/shop/components/Admin/OrderList/index";
    import { GachaList } from "@/features/shop/components/common/GachaList";
    import { Picker } from "@/features/shop/components/Mobile/sub/Picker";
  `;
  assert.deepEqual(checkScreenImports(grouped, opts), []);
});

test("isContainerDir: index.tsx を持つディレクトリだけをコンテナとみなす(core の別名を解決、index.ts だけの barrel は名前空間)", () => {
  assert.equal(isContainerDir("@/features/auth/components/Signup"), true);
  assert.equal(isContainerDir("@/features/core/auth/components/Signup"), true);
  assert.equal(isContainerDir("@/features/user/components/admin"), false);
  assert.equal(isContainerDir("@/features/userProfile/components/common"), false, "common/index.ts は barrel");
  assert.equal(isContainerDir("@/features/no-such-domain/components/X"), false);
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

test("checkLoaderFile: createLoader 製(Factory が cache を張る)も cache() 直書きも通る。void loader も純粋な解釈だけの loader も cache() か createLoader は必須", () => {
  const good = `import "server-only";\nimport { cache } from "react";\nconst r = cache(async () => 1);\nexport async function loadAdminHomeScreen() { return r(); }`;
  assert.deepEqual(checkLoaderFile(good), []);
  const factory = `import "server-only";\nimport { createLoader } from "@/app/admin/(protected)/guard";\nimport { adminListParts } from "@/wiring/domains";\nexport const loadAdminSampleListScreen = createLoader(adminListParts("sample"));`;
  assert.deepEqual(checkLoaderFile(factory), []);
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

// upstream は _screen/・_layout/ にドット区切り名のファイルを作らない(報告書 §2 W: ドット区切り名 = fork のカスタム)。
// fork はそこへ自分のカスタムを置く側なので、Tier1(src/lib/CATALOG.md の先頭節の持ち主 = 自分)でだけ検査する。
// 判定は eslint.config.mjs の fork 所有ライブラリと同じ isRoot(origin が分からないときは skip = 検査しない)。
const isUpstreamRoot = loadCatalogOwnership({ repoRoot, folder: "src/lib" }).isRoot;
test(
  "upstream は _screen/・_layout/ にドット区切り名のファイルを作らない(Tier1 のみ)",
  { skip: isUpstreamRoot ? false : "fork(Tier1 以外)ではドット区切り名のカスタムを置くので検査しない" },
  () => {
    assert.deepEqual(findDotNamedFiles(listAppFiles(repoRoot)), []);
  },
);

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
    "src/features/foo/_components/Bar.tsx",
    "src/app/(user)/my_components/X.tsx",
  ];
  assert.deepEqual(findForkOwnedDirFiles(files), [
    "src/app/(user)/wallet/_components/WalletScreen.tsx",
    "src/app/(user)/wallet/_components/parts/Row.tsx",
    "src/app/admin/(protected)/users/_components/loader.ts",
  ]);
});

test("findDotNamedFiles: _screen/・_layout/ 配下のドット区切り名だけを拾う(*.test.* は除く)", () => {
  const files = [
    "src/app/(user)/_layout/UserLayout.tsx",
    "src/app/(user)/_layout/UserLayout.custom.tsx",
    "src/app/(user)/_layout/UserLayout.test.tsx",
    "src/app/(user)/_layout/Header/index.acme.tsx",
    "src/app/(user)/_layout/hooks/useHeaderData.ts",
    "src/app/admin/(protected)/_layout/guard.ts",
    "src/app/(user)/wallet/_screen/WalletScreen.tsx",
    "src/app/(user)/wallet/_screen/WalletScreen.custom.tsx",
    "src/app/(user)/wallet/_components/WalletScreen.custom.tsx",
    "src/app/(user)/wallet/page.tsx",
    "src/app/route-map.jsonl",
  ];
  assert.deepEqual(findDotNamedFiles(files), [
    "src/app/(user)/_layout/UserLayout.custom.tsx",
    "src/app/(user)/_layout/Header/index.acme.tsx",
    "src/app/(user)/wallet/_screen/WalletScreen.custom.tsx",
  ]);
});

test("parseSwitchLayout: ./_layout/ への 1 行スイッチだけを許し、JSX 直書き・_screen 向き・複数の re-export を弾く", () => {
  const ok = `export { UserLayout as default } from "./_layout/UserLayout";\n`;
  assert.deepEqual(parseSwitchLayout(ok).problems, []);
  assert.deepEqual(parseSwitchLayout(ok).target, { screenDir: "_layout", file: "UserLayout", name: "UserLayout" });
  const custom = `// fork のカスタムへ\nexport { AcmeUserLayout as default } from "./_layout/UserLayout.acme";\n`;
  assert.deepEqual(parseSwitchLayout(custom).target, { screenDir: "_layout", file: "UserLayout.acme", name: "AcmeUserLayout" });
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

test("checkScreenLoaderCall(D21): 同じルートの loader を import し本体の最上位で await する。差し替え Screen は ../_screen/loader も可", () => {
  const ok = `import { loadXScreen } from "./loader";\nexport async function XScreen(props) {\n  const data = await loadXScreen(props);\n  return <p>{"it's"}{data.a}</p>;\n}`;
  assert.deepEqual(checkScreenLoaderCall(ok, "XScreen").problems, []);
  const fork = `import { loadXScreen } from "../_screen/loader";\nexport async function AcmeXScreen(props) {\n  await loadXScreen(props);\n  return null;\n}`;
  assert.deepEqual(checkScreenLoaderCall(fork, "AcmeXScreen").problems, []);
  const none = `export function XScreen() { return null; }`;
  assert.ok(checkScreenLoaderCall(none, "XScreen").problems[0].includes("import していない"));
  const inIf = `import { loadXScreen } from "./loader";\nexport async function XScreen(props) {\n  if (props.a) {\n    await loadXScreen(props);\n  }\n  return null;\n}`;
  assert.ok(checkScreenLoaderCall(inIf, "XScreen").problems[0].includes("最上位"));
  const afterReturn = `import { loadXScreen } from "./loader";\nexport async function XScreen(props) {\n  return <Wrap data={await loadXScreen(props)} />;\n}`;
  assert.ok(checkScreenLoaderCall(afterReturn, "XScreen").problems[0].includes("最上位"));
  const other = `import { loadXScreen } from "@/app/y/_screen/loader";\nexport async function XScreen(props) {\n  await loadXScreen(props);\n  return null;\n}`;
  assert.ok(checkScreenLoaderCall(other, "XScreen").problems.length > 0, "別ルートの loader は不可");
});
