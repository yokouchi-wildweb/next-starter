// page 層(page.tsx スイッチ + Screen + loader)の規律テスト。
// 実行: pnpm test:screens (node:test + tsx。registry の .ts を読むため tsx ランナーを使う)
//
// 登録は不要。検査対象は自動検出する(M1):
//   - src/app 全体のページ(./routeTree.mjs の discoverRoutes。`_` で始まるフォルダと src/app/api を除く、@slot は含む)から、
//     SCAN_EXCLUDES と fork の FORK_SCAN_EXCLUDES(src/registry/screenRoutesRegistry.ts)の配下を除いたもの
//     (除外は構造の検査だけ。ルート地図 src/app/route-map.txt には除外したページも載る)
//   - 検出した各ルートの _screen/loader.ts と _components/loader.ts(ルート内 loader)
//   - src/features/**/services/server/loaders/*.ts(多数のルートが共有する loader。再 export だけのファイルは除く)
//
// 守りたい契約(設計: src/lib/screens/README.md):
// 1. page.tsx は「./_screen/<X> または ./_components/<X> からの 1 行 re-export」+ 任意のページ設定
//    (metadata / dynamic 等の export、generateMetadata、それらに必要な import)だけ。画面ロジックを page.tsx に置かない
// 2. 参照先の Screen が存在し、その名前を named export していて、default export も "use client" も持たない
// 3. loader は `import "server-only"` と React の cache() を使い load<Xxx> を export する(ルート内・共有とも同じ)
// 4. まだスイッチ化していない page.tsx は、理由付きで例外リストに載せる(黙って古いままにしない):
//    upstream = 下の UPSTREAM_LEGACY_ROUTES(Step 5e で空になった。新しい core ルートはスイッチ形で作る)
//    fork     = src/registry/screenRoutesRegistry.ts の FORK_LEGACY_ROUTES
//    移行が済んだのに残っている行も失敗にする(一覧が縮む方向にしか動かない)
// 5. 枠を描く layout.tsx(FRAME_LAYOUTS)と ./_layout/ を指す layout.tsx は page.tsx と同じ 1 行スイッチ形
//    (参照先は ./_layout/<X>、採用者所有・write-once)。全 Tier で検査する
//
// 検査関数の本体は ./checks.mjs(副作用なし)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// fork の merge で export が欠けても import 時に落ちず、鮮度テストが指摘できるよう namespace import にする
import * as registry from "../../registry/screenRoutesRegistry.ts";
import {
  ROUTE_LOADER_FILE,
  SCREEN_DIRS,
  barrelTarget,
  checkLoaderFile,
  checkScreenFile,
  checkScreenImports,
  checkLayoutTarget,
  checkSwitchPage,
  findDotNamedFiles,
  isReexportOnlyFile,
  parseSwitchLayout,
  parseSwitchPage,
  stripComments,
} from "./checks.mjs";
import { discoverRoutes, listAppFiles } from "./routeTree.mjs";
import { loadCatalogOwnership } from "../folderCatalog/catalog.mjs";

export { checkLoaderFile, checkScreenFile, checkScreenImports, checkSwitchPage, isReexportOnlyFile, parseSwitchPage, stripComments };

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FORK_LEGACY_ROUTES = registry.FORK_LEGACY_ROUTES ?? [];
const FORK_SCAN_ROOTS = registry.FORK_SCAN_ROOTS ?? [];
const FORK_SCAN_EXCLUDES = registry.FORK_SCAN_EXCLUDES ?? [];
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");
const exists = (path) => existsSync(resolve(repoRoot, path));

/**
 * upstream がまだスイッチ化していない core ルート(理由を添える)。
 * Step 5 完了時点(5e)で空。新しい core ルートはスイッチ形で作るので、原則ここに行は増えない
 * (やむを得ず残す場合だけ { dir, reason } を足し、移行したら外す。移行済みの行が残っていると失敗する)
 */
export const UPSTREAM_LEGACY_ROUTES = [];

/**
 * upstream の枠を描く layout.tsx(1 行スイッチ形であること。ファイルが無ければ = fork がルートを消した → 検査しない)。
 * ガードと同居する admin/(protected)・insane の layout.tsx は提供者所有のまま(報告書 §7)なので載せない
 */
export const FRAME_LAYOUTS = ["src/app/(user)/layout.tsx", "src/app/(user)/(protected)/mypage/layout.tsx"];

// ---------------------------------------------------------------------------
// 検出
// ---------------------------------------------------------------------------

/**
 * 構造の検査から外すディレクトリとその配下(repo 相対)。fork は registry の FORK_SCAN_EXCLUDES で足す。
 * デモは動く見本を優先して 1 ファイルに書いているので外す。ルート地図からは外さない(認可の一覧に例外を作らない)
 */
export const SCAN_EXCLUDES = ["src/app/(user)/demo", "src/app/admin/(protected)/tabs-demo"];

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

const legacyEntries = [...UPSTREAM_LEGACY_ROUTES, ...FORK_LEGACY_ROUTES];
const legacyDirs = new Map(legacyEntries.map((e) => [e.dir, e.reason]));
const pages = discoverPages();
const pageByDir = new Map(pages.map((p) => [dirname(p), p]));
const pageDirs = new Set(pageByDir.keys());

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
    test(`${dir}: ${target.screenDir}/${target.file} が ${target.name} を named export する Server Component で、features の import は components/<Name> まで`, () => {
      const file = resolveScreenFile(dir, target);
      assert.ok(file, `${dir}/${target.screenDir}/${target.file}(.tsx | /index.tsx) が無い`);
      const source = read(file);
      const screenProblems = [...checkScreenFile(source, target.name), ...checkScreenImports(source, { isContainerDir })];
      assert.deepEqual(screenProblems, [], `${file}: ${screenProblems.join(" / ")}`);
    });
  }
}

// 枠の layout.tsx: FRAME_LAYOUTS と、./_layout/ を指す re-export を持つ layout.tsx(fork が自分で作ったスイッチも同じ規則)
const layoutFiles = listAppFiles(repoRoot).filter((file) => file.endsWith("/layout.tsx"));
const switchLayouts = layoutFiles.filter(
  (file) => FRAME_LAYOUTS.includes(file) || /from\s*["']\.\/_layout\//.test(stripComments(read(file))),
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
    const { problems, target } = parseSwitchPage(read(pageByDir.get(entry.dir)));
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

test("FORK_SCAN_ROOTS / FORK_SCAN_EXCLUDES: 不要になった FORK_SCAN_ROOTS の行・存在しない・重複した除外が無い", () => {
  const stale = staleScanEntries();
  assert.deepEqual(stale, [], `src/registry/screenRoutesRegistry.ts を更新する:\n${stale.join("\n")}`);
});

// wallet ルートは fork が削除してよい(README §7)ので、ディレクトリがあるときだけ「検出されること」を検査する
const walletDir = "src/app/(user)/(protected)/wallet";
const hasWallet = exists(`${walletDir}/page.tsx`);

test("検出範囲: src/app 全体(wallet(あれば)・管理画面・debug)が含まれ、demo と生成テンプレートは含まれない", () => {
  if (hasWallet) {
    assert.ok(pageDirs.has(walletDir));
    assert.ok(pageDirs.has(`${walletDir}/[slug]/history`));
  }
  assert.ok(pageDirs.has("src/app/(user)"), "トップページ(_screen/StarterHomeScreen)が検出されていない");
  assert.ok([...pageDirs].some((d) => d.startsWith("src/app/admin/(protected)/")), "生成された管理画面ルートが検出されていない");
  assert.equal([...pageDirs].some((d) => d.startsWith("src/app/(user)/demo")), false);
  // 手書きの管理画面(dc:generate 由来でない)も検出し、管理画面のデモと生成テンプレートは外す
  for (const dir of ["src/app/admin/(protected)", "src/app/admin/login", "src/app/admin/(protected)/users/general"]) {
    assert.ok(pageDirs.has(dir), `${dir} が検出されていない`);
  }
  assert.equal([...pageDirs].some((d) => d.startsWith("src/app/admin/(protected)/tabs-demo")), false);
  assert.equal([...pageDirs].some((d) => d.startsWith("src/app/admin/_template")), false);
  // 固定の走査範囲の外だった区域も検出する(M1)
  assert.ok(pageDirs.has("src/app/debug"), "src/app/debug が検出されていない");
  assert.equal([...pageDirs].some((d) => d.startsWith("src/app/api")), false);
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

test("checkLoaderFile: 共有 loader(load<Xxx>)も個別 loader(load<Name>Screen)も通る。void loader も純粋な解釈だけの loader も cache() は必須", () => {
  const good = `import "server-only";\nimport { cache } from "react";\nconst r = cache(async () => 1);\nexport async function loadAdminRelationOptions() { return r(); }`;
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
    "src/app/route-map.txt",
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
  const jsx = `import type { ReactNode } from "react";\nimport { UserAppLayout } from "@/app/(user)/_layout/UserLayout";\nexport default function L({ children }: { children: ReactNode }) {\n  return <UserAppLayout>{children}</UserAppLayout>;\n}`;
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
