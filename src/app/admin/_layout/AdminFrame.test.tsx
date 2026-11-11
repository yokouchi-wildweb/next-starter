// 管理の枠の部位の data-slot と枠の表の結線の検査。実行: pnpm test src/app/admin/_layout/AdminFrame.test.tsx
//
// 1. README の data-slot の一覧 = 管理の枠の部品(admin/_layout・(protected)/_layout)の要素に付く data-slot(両方向)。
//    一覧 = 部位の一覧(src/app/_layout/frame/parts.mjs の管理の枠)、shadcn の部品の data-slot と衝突しない、data-frame-part は残っていない
// 2. 外枠(AdminLayout)は管理の表を共通の読み手 useFrameAttributes に渡し、当たった行の属性が初回の静的描画に入る
// 3. fill の的: 本文の直接の親 [data-admin-main-wrapper] が (protected) にある
// 読み手の行の選び方は src/app/_layout/frame/useFrameAttributes.test.tsx、frame.css の規則と部位の一覧は src/app/_layout/frame のテスト
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement, type ReactNode } from "react";

const segments: { current: string[] | null } = { current: null };
mock.module("next/navigation", {
  namedExports: { useSelectedLayoutSegments: () => segments.current, usePathname: () => "/admin", useRouter: () => ({ push: () => {} }) },
});

/** 結線を見る表(上流の管理の表は空) */
const TABLE = [
  { pattern: [], scope: "layout", hide: [], fill: false },
  { pattern: ["(protected)", "board", "[id]"], scope: "page", hide: ["admin-footer-pc"], fill: true },
] as const;

const here = (path: string) => pathToFileURL(join(__dirname, path)).href;
mock.module(here("./extensions/frameTable.ts"), { namedExports: { frameTable: TABLE } });
mock.module("@/components/Fanctional/DarkModeSwitch", { namedExports: { DarkModeSwitch: () => null } });
mock.module("@/features/core/auth/hooks/useAuthSession", { namedExports: { useAuthSession: () => ({ isAuthenticated: false }) } });

const repo = join(__dirname, "../../../..");
const read = (path: string) => readFileSync(join(repo, path), "utf8");

let render: (node: ReactNode) => string;
let AdminLayout: typeof import("./AdminLayout").AdminLayout;
let parts: typeof import("@/app/_layout/frame");
let AdminPage: typeof import("./AdminPage").default;
let ItemNavigator: typeof import("@/components/AppFrames/Admin/Elements/ItemNavigator").ItemNavigator;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ AdminLayout } = await import("./AdminLayout"));
  parts = await import("@/app/_layout/frame");
  AdminPage = (await import("./AdminPage")).default;
  ({ ItemNavigator } = await import("@/components/AppFrames/Admin/Elements/ItemNavigator"));
});

/** 管理の枠の部品のソース(テストを除く .tsx / .ts) */
const FRAME_DIRS = ["src/app/admin/_layout", "src/app/admin/(protected)/_layout"];
const sourcesOf = (dir: string): string[] =>
  readdirSync(join(repo, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "extensions" ? [] : sourcesOf(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
const FRAME_FILES = FRAME_DIRS.flatMap(sourcesOf);

/** ソースの要素に付く data-slot="<名前>"(名前 → 付いているファイル) */
const slotsInSources = () => {
  const found = new Map<string, string[]>();
  for (const file of FRAME_FILES) {
    for (const m of read(file).matchAll(/data-slot="([a-z0-9-]+)"/g)) {
      found.set(m[1], [...(found.get(m[1]) ?? []), relative("src/app/admin", file)]);
    }
  }
  return found;
};

/** README の「data-slot の一覧」の節の名前(行頭 `- \`<名前>\``) */
const slotsInReadme = () => {
  const readme = read("src/app/admin/_layout/README.md");
  const section = /\n## data-slot の一覧\n([\s\S]*?)(\n## |$)/.exec(readme)?.[1];
  assert.ok(section, "README に「## data-slot の一覧」の節が無い");
  return [...section.matchAll(/^- `([a-z0-9-]+)`/gm)].map((m) => m[1]);
};

test("README の data-slot の一覧 = 管理の枠の部品の要素の data-slot(片方にしか無い名前なし)= 部位の一覧の管理の枠", () => {
  const listed = slotsInReadme();
  const found = slotsInSources();
  assert.deepEqual([...listed].sort(), [...found.keys()].sort(), `README ${listed.join(",")} / 要素 ${[...found.keys()].join(",")}`);
  assert.equal(new Set(listed).size, listed.length, "README の一覧に重複");
  const adminSlots = parts.FRAME_SLOTS.filter((s) => s.area === "admin").map((s) => s.name);
  assert.deepEqual([...listed].sort(), [...adminSlots].sort(), "部位の一覧(parts.mjs)の管理の枠と一致しない");
  for (const { slot } of parts.hideableParts("admin")) assert.ok(found.has(slot), `隠せる部位 ${slot} の要素が無い`);
});

test("サイドバーの data-slot は PC の列・SP のドロワーと背景・リサイズのつまみ・SP の開閉ボタンの包みに付く(Button の data-slot は上書きしない)", () => {
  const count = (file: string) => read(file).split('data-slot="admin-sidebar"').length - 1;
  for (const [file, n] of [
    ["src/app/admin/(protected)/_layout/Sidebar/PcSidebar.tsx", 1],
    ["src/app/admin/(protected)/_layout/Sidebar/SpSidebar.tsx", 2],
    ["src/app/admin/(protected)/_layout/ResizableArea.tsx", 1],
    ["src/app/admin/(protected)/_layout/AdminProtectedLayout.tsx", 1],
  ] as const) {
    assert.equal(count(file), n, `${file} の admin-sidebar`);
  }
  // shadcn の部品の data-slot は上書きしない: 開閉ボタンは display: contents の包みが印を持ち、Button 自身は data-slot を持たない。
  // id はサイドバーを差し替えた fork 向けの橋渡し
  for (const file of ["src/app/admin/(protected)/_layout/AdminProtectedLayout.tsx"]) {
    const toggle = /<div data-slot="admin-sidebar" className="contents">\s*<Button\s([^>]*)>[\s\S]*?<\/Button>\s*<\/div>/.exec(read(file));
    assert.ok(toggle, `${file}: 開閉ボタンが admin-sidebar の包みの直下に無い`);
    assert.ok(toggle[1].includes('id="admin-sidebar-toggle"'), `${file} の開閉ボタンの id`);
    assert.equal(toggle[1].includes("data-slot"), false, `${file}: Button の data-slot を上書きしている`);
  }
});

test("管理の枠の data-slot は shadcn の部品の data-slot と衝突せず、部位の印 data-frame-part は残っていない", () => {
  const shadcnDir = "src/components/_shadcn";
  const shadcn = new Set(
    sourcesOf(shadcnDir).flatMap((file) => [...read(file).matchAll(/data-slot="([a-z0-9-]+)"/g)].map((m) => m[1])),
  );
  assert.ok(shadcn.has("button"), "shadcn の data-slot を読めていない");
  for (const name of slotsInSources().keys()) assert.equal(shadcn.has(name), false, `${name} は shadcn と衝突`);
  for (const file of FRAME_FILES) assert.equal(read(file).includes("data-frame-part"), false, `${file} に data-frame-part`);
});

test("外枠(AdminLayout)は管理の表を共通の読み手に渡し、当たった行の属性が初回の静的描画に入る(宣言が無ければ data-frame-root だけ)", () => {
  assert.match(read("src/app/admin/_layout/AdminLayout.tsx"), /useFrameAttributes\(frameTable\)/);
  segments.current = ["(protected)", "board", "12"];
  assert.match(
    render(createElement(AdminLayout, null, "CHILD")),
    /text-foreground" data-slot="admin-app-container" data-frame-root="" data-frame-hide="admin-footer-pc" data-frame-fill="">/,
  );
  segments.current = ["(protected)", "users"];
  assert.match(render(createElement(AdminLayout, null, "CHILD")), /data-slot="admin-app-container" data-frame-root="">/);
  segments.current = null;
  assert.match(render(createElement(AdminLayout, null, "CHILD")), /data-frame-root="">/);
});

test("上流は管理の枠の宣言を持たない(表は空。Tier1 だけ: fork は frame.ts で枠を宣言してよい)", async (t) => {
  const { readForkIdentity } = await import("@/lib/forkOwnership/forkIds.mjs");
  if (!readForkIdentity(repo).isTier1) {
    t.skip("上流の枠の表が空であることの検査（Tier1 だけ。fork は自分の frame.ts の宣言を持つ）");
    return;
  }
  assert.match(read("src/app/admin/_layout/extensions/frameTable.ts"), /export const frameTable = \[\] as const satisfies FrameTable;/);
});

test("AdminPage の fill の prop は無く、fill の的(本文の直接の親)は (protected) にある", () => {
  assert.equal(read("src/app/admin/_layout/AdminPage.tsx").includes("fill?:"), false);
  assert.ok(read("src/app/admin/(protected)/_layout/ResizableArea.tsx").includes('data-slot="admin-main" data-admin-main-wrapper'));
});

// ---- ヘッダーの行を描く AdminPage を使わない管理のページ(指令 14 d3。止める検査は指令 17) ----

/** src/app/admin の下の page.tsx(_ で始まるフォルダ = _template などは除く) */
const adminPages = (dir = "src/app/admin"): string[] =>
  readdirSync(join(repo, dir), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name.startsWith("_") ? [] : adminPages(join(dir, entry.name));
    return entry.name === "page.tsx" ? [join(dir, entry.name)] : [];
  });

/** page.tsx の 1 行スイッチが指す Screen のファイル(`from "./_screen/X"` / `"./_components/X"`) */
const screenOf = (pagePath: string) => {
  const target = /from "\.\/((?:_screen|_components)\/[^"]+)"/.exec(read(pagePath))?.[1];
  assert.ok(target, `${pagePath} が _screen / _components の Screen を指していない`);
  const base = join(pagePath, "..", target);
  for (const ext of [".tsx", ".ts", "/index.tsx"]) {
    try {
      return { path: base + ext, source: read(base + ext) };
    } catch {
      // 次の拡張子
    }
  }
  assert.fail(`${pagePath} の Screen ${target} が無い`);
};

test("AdminPage を使わない管理のページは無い(settings の入口も AdminPage を返す。止める検査に例外を作らない)", () => {
  const pages = adminPages();
  assert.ok(pages.length > 30, `管理のページを読めていない(${pages.length})`);
  const without = pages.filter((page) => !/\bAdminPage\b/.test(screenOf(page).source)).map((page) => relative("src/app/admin", page));
  assert.deepEqual(without, []);
});

test("未ログインの login・setup は AdminPage main={false} で包み、行には題だけを渡す(中央・右の操作なし)= 操作はロゴの Link と明暗の切り替えだけ(指令 14 AMENDMENT 1 (2)、題は指令 15 (a))", () => {
  for (const file of ["src/app/admin/login/_screen/AdminLoginScreen.tsx", "src/app/admin/setup/_screen/AdminSetupScreen.tsx"]) {
    const source = read(file);
    assert.match(source, /<AdminPage main=\{false\} title="[^"]+">/, `${file} が AdminPage main={false} title で包んでいない`);
    assert.equal(/<AdminPage[^>]*\b(center|actions)=/.test(source), false, `${file} の行に中央・右の操作を渡している`);
    assert.equal(source.includes("AdminHeaderPortal"), false, `${file} がヘッダーに差し込んでいる`);
  }
  // 行の中身 = ロゴの Link 1 つ + 空の受け口 3 つ + 明暗の切り替え(操作はそれだけ)
  const header = read("src/app/admin/_layout/AdminHeader.default.tsx");
  assert.equal(header.split("<Link ").length - 1, 1);
  assert.equal(header.split("<DarkModeSwitch").length - 1, 1);
  for (const prop of ["{title}", "{center}", "{actions}"]) assert.ok(header.includes(prop), prop);
});

// ---- 題と中央の差し込み(指令 15) ----

/** 上流の管理の画面のソース(src/app/admin の .tsx。_layout の部品とテストを除く。_template は含む) */
const adminScreenSources = (dir = "src/app/admin"): string[] =>
  readdirSync(join(repo, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === "src/app/admin/_layout" ? [] : adminScreenSources(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [path] : [];
  });

test("上流の管理の画面(_template を含む)は題を AdminPage title で渡す: PageTitle と placement= の使用 0、題のある AdminPage の題は 1 つ", () => {
  const files = adminScreenSources();
  assert.ok(files.some((f) => f.includes("/_template/")), "_template を読めていない");
  for (const file of files) {
    const source = read(file);
    assert.equal(source.includes("_layout/PageTitle"), false, `${file} が PageTitle を使っている`);
    assert.equal(/\bplacement=/.test(source), false, `${file} に placement=`);
  }
  // 題を持たない AdminPage は無い
  const untitled = adminPages()
    .map((p) => screenOf(p))
    .filter(({ source }) => !/<AdminPage\b[^>]*\btitle=/.test(source))
    .map(({ path }) => relative("src/app/admin", path))
    .sort();
  assert.deepEqual(untitled, []);
  for (const file of ["Admin__Domain__ListScreen.tsx", "new/_screen/Admin__Domain__CreateScreen.tsx", "[id]/edit/_screen/Admin__Domain__EditScreen.tsx", "sort/_screen/Admin__Domain__SortScreen.tsx"]) {
    const path = file.includes("/") ? `src/app/admin/_template/__domains__/${file}` : `src/app/admin/_template/__domains__/_screen/${file}`;
    assert.match(read(path), /<AdminPage title="__DomainLabel__[^"]+"/, `${path} の雛形が AdminPage title の形でない`);
  }
});

test("中央の差し込み(銀行振込の status タブ・クーポンのタブ)は AdminPage center", () => {
  assert.match(read("src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/AdminBankTransferReviewsScreen.tsx"), /<AdminPage title="銀行振込レビュー" center=\{<BankTransferStatusTabs \/>\}>/);
  for (const section of ["official", "affiliate", "invite"]) {
    const screen = sourcesOf(`src/app/admin/(protected)/coupons/${section}/_screen`).map(read).join("\n");
    assert.match(screen, /center=\{<CouponSectionTabs variant="header" \/>\}/, `coupons/${section}`);
  }
});

// ---- ヘッダーの差し込みの仕組みと互換を消した(指令 17) ----

test("上流(src)に AdminHeaderPortal・HeaderSlots・受け口の id とその定数・互換の PageTitle / Header / useItemNavigator・CouponSectionTabs の placement・AdminLayout の header の prop が無い(テストを除く、README とコメントも)", () => {
  const files = sourcesOf("src").filter((file) => !/\.test\.tsx?$/.test(file));
  const readmes = (dir: string): string[] =>
    readdirSync(join(repo, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" ? [] : readmes(path);
      return entry.name.endsWith(".md") ? [path] : [];
    });
  const patterns = [
    /AdminHeaderPortal/,
    /\bHeaderSlots\b/,
    /ADMIN_HEADER_(?:TITLE|CENTER|RIGHT)_SLOT_ID/,
    /admin-header-(?:title|center|right)-slot/,
    /\buseItemNavigator\b/,
    /PageTitle placement/,
    /CouponSectionTabs placement/,
    /admin\/_layout\/(?:PageTitle|Header|HeaderSlots|AdminHeaderContext)\b/,
  ];
  const hits = [...files, ...readmes("src")].flatMap((file) =>
    patterns.filter((pattern) => pattern.test(read(file))).map((pattern) => `${relative("src", file)}: ${pattern}`),
  );
  assert.deepEqual(hits, []);
  for (const gone of ["src/app/admin/_layout/PageTitle.tsx", "src/app/admin/_layout/Header.tsx", "src/app/admin/_layout/HeaderSlots.tsx", "src/app/admin/_layout/AdminHeaderContext.tsx"]) {
    assert.throws(() => read(gone), `${gone} が残っている`);
  }
  assert.equal(/placement/.test(read("src/app/admin/(protected)/coupons/_screen/CouponSectionTabs.tsx")), false);
});
// ---- 前後の項目へ移る(指令 16) ----

const NAV_DIR = "src/components/AppFrames/Admin/Elements/ItemNavigator";

test("ItemNavigator は移るだけ: portal・react-hook-form・保存・トーストを持たない(フォルダの中のどのファイルも)", () => {
  const navigator = read(`${NAV_DIR}/ItemNavigator.tsx`);
  for (const word of ["AdminHeaderPortal", "react-hook-form", "useToast", "onBeforeNavigate", "usePortal"]) {
    assert.equal(navigator.includes(word), false, `ItemNavigator.tsx に ${word}`);
  }
  assert.match(navigator, /router\.push\(getPath\(nextId\)\)/);
  for (const file of sourcesOf(NAV_DIR)) {
    assert.equal(read(file).includes("react-hook-form"), false, `${file} が react-hook-form を読む`);
  }
});

test("AdminPage actions に置いた ItemNavigator は行の右の位置(data-slot admin-header-right)に描かれ、候補は items の順・表示名は getLabel", () => {
  const items = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const html = render(
    <AdminPage
      actions={
        <ItemNavigator items={items} currentId="a" getPath={(id) => `/admin/x/${id}/edit`} getLabel={(item) => `L-${item.name}`} />
      }
    >
      CHILD
    </AdminPage>,
  );
  const right = /<div data-slot="admin-header-right"[^>]*>([\s\S]*?)<\/div><\/div>/.exec(html)?.[1] ?? "";
  assert.ok(right.includes("切り替え"), html);
  assert.ok(html.indexOf("L-A") < html.indexOf("L-B") || !html.includes("L-B"), "候補の順");
});

test("ItemNavigator の長い項目名: 閉じた値はどの画面幅でも … で省き、開いた一覧は画面の幅 − 左右 16px までで項目名を折り返す", () => {
  const long = "長".repeat(198);
  const html = render(<ItemNavigator items={[{ id: "a" }]} currentId="a" getPath={(id) => `/admin/x/${id}/edit`} getLabel={() => long} />);
  // 選択欄(閉じた状態)に値の省略のクラス。max-sm: の付かない形 = PC でも効く
  for (const cls of ["*:data-[slot=select-value]:block", "*:data-[slot=select-value]:min-w-0", "*:data-[slot=select-value]:truncate"]) {
    assert.ok(html.includes(` ${cls}`) || html.includes(`"${cls}`), `選択欄に ${cls}`);
  }
  // 開いた一覧はポータルで描くので、部品が SelectInput に渡す contentClassName を字面で見る
  const source = read(`${NAV_DIR}/ItemNavigator.tsx`);
  assert.match(source, /contentClassName=\{LIST_BOUNDED\}/);
  assert.match(source, /max-w-\[calc\(100vw-2rem\)\]/);
  assert.match(source, /\[&_\[data-slot=select-item\]\]:whitespace-normal/);
});

test("上流の編集画面(core 2・サンプル 3・管理の _template)は AdminPage actions に AdminEditItemNavigator を置き", () => {
  const screens = [
    "src/app/admin/_template/__domains__/[id]/edit/_screen/Admin__Domain__EditScreen.tsx",
    "src/app/admin/(protected)/user-tags/[id]/edit/_screen/AdminUserTagEditScreen.tsx",
    "src/app/admin/(protected)/chat-rooms/[id]/edit/_screen/AdminChatRoomEditScreen.tsx",
    "src/app/admin/(protected)/samples/[id]/edit/_screen/AdminSampleEditScreen.tsx",
    "src/app/admin/(protected)/sample-categories/[id]/edit/_screen/AdminSampleCategoryEditScreen.tsx",
    "src/app/admin/(protected)/sample-tags/[id]/edit/_screen/AdminSampleTagEditScreen.tsx",
  ];
  for (const file of screens) {
    assert.match(read(file), /<AdminPage title="[^"]+" actions=\{<AdminEditItemNavigator domain=\{\w+Display\} current=\{\w+\} \/>\}>/, file);
  }
  // 部品 = データの hook(src/lib/crud)+ 移るだけの表示(棚)の組み合わせ
  const part = read("src/app/admin/_layout/AdminEditItemNavigator.tsx");
  assert.match(part, /useDomainItemNavigation\(options\)/);
  assert.match(part, /<ItemNavigator \{\.\.\.navigation\}/);
  // ヘッダーの行(SP 52px・中身 36px)に収める: SP だけ選択欄を h-8 に詰めて縮め、ラベルは見た目だけ隠す。PC は既定の大きさのまま(… は ItemNavigator の決まり)
  assert.match(part, /const SP_FIT =\s*"max-sm:!h-8 max-sm:py-0 max-sm:min-w-0 /);
  assert.match(part, /const SP_LABEL = "max-sm:sr-only";/);
  assert.match(part, /labelClassName=\{SP_LABEL\} selectClassName=\{SP_FIT\}/);
  assert.match(read(`${NAV_DIR}/ItemNavigator.tsx`), /className=\{cn\("min-w-\[160px\] max-w-\[240px\]", VALUE_TRUNCATE, selectClassName\)\}/);
  const hook = read("src/lib/crud/hooks/useDomainItemNavigation.ts");
  assert.match(hook, /createApiClient<T>\(`\/api\/\$\{domain\.singular\}`\)/);
  assert.match(hook, /getAdminPaths\(domain\.plural\)\.edit/);
  assert.match(hook, /limit = 10/);
});
