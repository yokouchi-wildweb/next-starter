// 管理画面の枠(AdminLayout・AdminProtectedLayout・InsaneProtectedLayout)とページ枠部品(AdminPage・AdminHeader)の
// slot / props と、props なしの描画が slot 化の前(a77da63d)と同じことの検査(足したのは枠の根の data-frame-root・部位の data-slot="admin-*"・
// insane の data-admin-main-wrapper だけ。data-slot の一覧と枠の表の結線は ./AdminFrame.test.tsx)。
// 実行: pnpm test:admin-layout(test:user-layout と同じ方式: tsx + node:test のモジュールモック + react-dom/server の静的描画)
//
// 重い部品(BaseSidebar・InsaneSidebar・DarkModeSwitch・Button)と useHeaderHeight・useAuthSession は目印にモックし、
// 枠そのもの(外枠・Header・受け口・サイドバーの殻・リサイズのつまみ・Footer・並び順)は本物を描く。
// サイドバー幅の調整は有効(APP_FEATURES をモック)= fork の設定値に左右されない。
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement, type ReactNode } from "react";

import { businessConfig } from "@/config/business.config";
import { logoPath } from "@/utils/assets";

// サイドバーの目印は onNavigate を受けたか(= SP の殻の中か)を data-nav で示す
const marker = (name: string) => {
  const Marker = ({ onNavigate }: { onNavigate?: () => void }) => createElement(`x-${name}`, onNavigate ? { "data-nav": "" } : null);
  Marker.displayName = `Marker(${name})`;
  return Marker;
};
const here = (path: string) => pathToFileURL(join(__dirname, path)).href;

// ヘッダーの高さ: 既定は測った値 0(前の DOM の --app-header-height:0px)。null = 測る前
// AdminLayout はもうヘッダーの高さを測らない(呼ばれたら失敗させる)
mock.module("@/hooks/useHeaderHeight", {
  namedExports: {
    useHeaderHeight: () => {
      throw new Error("AdminLayout はヘッダーの高さを測らない");
    },
  },
});
// 明暗の切り替えの目印は受けた className を class に写す(行のはみ出しの決まり = shrink-0 を見る)
mock.module("@/components/Fanctional/DarkModeSwitch", {
  namedExports: { DarkModeSwitch: ({ className }: { className?: string }) => createElement("x-darkmode", className ? { class: className } : null) },
});
// 編集画面の「前後の項目へ移る」のデータ: 名前がとても長い今の項目 1 件(SP で行の幅を超える名前)
const LONG_LABEL = "z".repeat(400);
mock.module("@/lib/crud/hooks", {
  namedExports: {
    useDomainItemNavigation: () => ({
      items: [{ id: "a", name: LONG_LABEL }],
      currentId: "a",
      getPath: (id: string) => `/admin/samples/${id}/edit`,
      getLabel: (item: { name: string }) => item.name,
      isLoading: false,
    }),
  },
});
mock.module("@/features/core/auth/hooks/useAuthSession", { namedExports: { useAuthSession: () => ({ isAuthenticated: false }) } });
mock.module("@/components/Form/Button/Button", {
  namedExports: {
    Button: (p: { variant?: string; "aria-label"?: string; "aria-pressed"?: boolean }) =>
      createElement("x-button", { "data-variant": p.variant, "aria-label": p["aria-label"], "aria-pressed": String(p["aria-pressed"]) }),
  },
});
mock.module("@/config/app/app-features.config", { namedExports: { APP_FEATURES: { adminConsole: { enableSidebarResizing: true } } } });
mock.module(here("../(protected)/_layout/Sidebar/BaseSidebar.tsx"), { namedExports: { BaseSidebar: marker("basesidebar") } });
mock.module(here("../insane/_layout/InsaneSidebar.tsx"), { namedExports: { InsaneSidebar: marker("insanesidebar") } });

let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let AdminLayout: typeof import("./AdminLayout").AdminLayout;
let AdminHeader: typeof import("./AdminHeader").AdminHeader;
let useAdminSidebarFrame: typeof import("./Sidebar/AdminSidebarFrame").useAdminSidebarFrame;
let AdminProtectedLayout: typeof import("../(protected)/_layout/AdminProtectedLayout").AdminProtectedLayout;
let InsaneProtectedLayout: typeof import("../insane/_layout").InsaneProtectedLayout;
let AdminPage: typeof import("./AdminPage").default;
let AdminEditItemNavigator: typeof import("./AdminEditItemNavigator").AdminEditItemNavigator;
before(async () => {
  ({ AdminEditItemNavigator } = await import("./AdminEditItemNavigator"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ AdminLayout } = await import("./AdminLayout"));
  ({ AdminHeader } = await import("./AdminHeader"));
  ({ useAdminSidebarFrame } = await import("./Sidebar/AdminSidebarFrame"));
  ({ AdminProtectedLayout } = await import("../(protected)/_layout/AdminProtectedLayout"));
  ({ InsaneProtectedLayout } = await import("../insane/_layout"));
  AdminPage = (await import("./AdminPage")).default;
});

const render = (node: ReactNode) => renderToStaticMarkup(node);
const FOOTER_TEXT = `© ${new Date().getFullYear()} ${businessConfig.serviceName}`;

// ---- slot 化の前(a77da63d)の部品を同じモックで描いた HTML + 枠の部位の印。既定の DOM・id・順序の基準 ----

/**
 * ロゴは AppImage(intrinsic, 300x61, priority)。テストは next.config を読まないので next/image の既定(最適化あり・q=75)の URL になる。
 * 本番で IMAGE_OPTIMIZATION が無効の間は unoptimized で素のパスが入る(ここでは見ない)
 */
const logoOptimizedUrl = (variant: "dark" | "light", width: number) =>
  `/_next/image?url=${encodeURIComponent(logoPath(variant))}&amp;w=${width}&amp;q=75`;
const logoSrcSet = (variant: "dark" | "light") => `${logoOptimizedUrl(variant, 384)} 1x, ${logoOptimizedUrl(variant, 640)} 2x`;
const LOGO_IMG = (variant: "dark" | "light", alt: string, className: string) =>
  `<img data-component="AppImage" alt="${alt}" width="300" height="61" decoding="async" data-nimg="1" class="${className}" style="color:transparent" srcSet="${logoSrcSet(variant)}" src="${logoOptimizedUrl(variant, 640)}"/>`;
const LOGO_PRELOAD = (variant: "dark" | "light") => `<link rel="preload" as="image" imageSrcSet="${logoSrcSet(variant)}"/>`;

/** slot 化の前の旧 admin/layout.tsx が描いていた物のヘッダー(ロゴだけ AppImage 化で差し替え) */
const BEFORE_HEADER = `<header id="header" data-slot="admin-header" class="flex items-center justify-between gap-3 px-4 py-[var(--admin-header-padding-y)] text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:text-lg"><a class="block shrink-0 p-1 sm:p-2" href="/admin">${LOGO_IMG("dark", "管理画面ロゴ（ライトモード）", "block h-auto w-auto max-h-6 max-w-[120px] dark:hidden sm:max-h-12 sm:max-w-[300px]")}${LOGO_IMG("light", "管理画面ロゴ（ダークモード）", "hidden h-auto w-auto max-h-6 max-w-[120px] dark:block sm:max-h-12 sm:max-w-[300px]")}</a><div data-slot="admin-header-title" class="hidden min-w-0 shrink items-center border-l border-border/40 pl-4 sm:flex"></div><div data-slot="admin-header-center" class="flex min-w-0 flex-1 items-center justify-center"></div><div class="flex shrink-0 items-center gap-3"><div data-slot="admin-header-right" class="flex items-center gap-3"></div><x-darkmode></x-darkmode></div></header>`;
/** 既定の Header のロゴ画像が文書の先頭に出す preload(Header を描かないときは出ない) */
const BEFORE_LOGO_PRELOAD = LOGO_PRELOAD("dark") + LOGO_PRELOAD("light");
/** 同じく外枠全体 */
const BEFORE_OUTER = BEFORE_LOGO_PRELOAD + `<div class="relative flex h-[var(--viewport-height,100dvh)] flex-col overflow-hidden bg-background text-foreground" style="--app-header-height:0px" data-slot="admin-app-container" data-frame-root="">` + BEFORE_HEADER + `<div class="flex-1 min-h-0 flex flex-col overflow-clip">CHILD</div></div>`;
/** `<AdminProtectedLayout>CHILD</AdminProtectedLayout>` */
const BEFORE_PROTECTED = `<div class="flex h-full min-h-0 relative"><div data-slot="admin-sidebar" style="width:192px" class="fixed inset-y-0 right-0 navigation-layer transition-transform md:hidden translate-x-full"><x-basesidebar data-nav=""></x-basesidebar></div><div data-slot="admin-sidebar" class="hidden md:block h-full" style="width:192px"><x-basesidebar></x-basesidebar></div><div data-slot="admin-sidebar" class="hidden md:block h-full w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"></div><div class="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden"><div data-slot="admin-main" data-admin-main-wrapper="true" class="flex-1">CHILD</div><footer id="footer" data-slot="admin-footer" class="h-12 flex items-center justify-center px-6 bg-background text-foreground shadow-inner text-sm">${FOOTER_TEXT}</footer></div></div><div data-slot="admin-sidebar" class="contents"><x-button data-variant="accent" aria-label="メニューを開く" aria-pressed="false"></x-button></div>`;
/** `<InsaneProtectedLayout>CHILD</InsaneProtectedLayout>` */
const BEFORE_INSANE = `<div class="flex flex-1 flex-col min-h-0"><div class="flex flex-1 min-h-0 relative"><div data-slot="admin-sidebar" style="width:192px" class="fixed inset-y-0 right-0 navigation-layer transition-transform md:hidden translate-x-full"><x-insanesidebar data-nav=""></x-insanesidebar></div><div data-slot="admin-sidebar" class="hidden md:block" style="width:192px"><x-insanesidebar></x-insanesidebar></div><div data-slot="admin-sidebar" class="hidden md:block w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"></div><div data-slot="admin-main" data-admin-main-wrapper="" class="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden">CHILD</div></div><div data-slot="admin-sidebar" class="contents"><x-button data-variant="destructive" aria-label="メニューを開く" aria-pressed="false"></x-button></div></div>`;
/** `<AdminPage>CHILD</AdminPage>`(fill は枠の宣言 + frame.css に移った。AdminPage の DOM は通常のページのまま) */
const BEFORE_PAGE = `<main data-component="Main" id="main" class="max-w-screen overflow-hidden mx-auto w-full p-4 sm:p-6 py-6 sm:py-10">CHILD</main>`;
/** `<PageTitle>T</PageTitle>`(当時の既定 = page)/ `<PageTitle placement="header">T</PageTitle>`(SSR では AdminHeaderPortal は何も描かない) */
const BEFORE_TITLE_PAGE = `<h1 class="tracking-tight text-2xl font-normal text-left relative px-4 py-2 text-foreground bg-gradient-to-tr from-secondary/15 via-secondary/5 to-transparent dark:from-secondary/30 dark:via-secondary/15 dark:to-transparent after:absolute after:left-4 after:-bottom-1 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-[&#x27;&#x27;] mb-8 sm:text-3xl">T</h1>`;
const BEFORE_TITLE_HEADER = `<h1 class="tracking-tight text-2xl font-normal text-left relative px-4 py-2 text-foreground bg-gradient-to-tr from-secondary/15 via-secondary/5 to-transparent dark:from-secondary/30 dark:via-secondary/15 dark:to-transparent after:absolute after:left-4 after:-bottom-1 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-[&#x27;&#x27;] mb-8 sm:text-3xl sm:hidden">T</h1>`;

// ---- AdminLayout(外枠)と AdminHeader(行の部品・1 行スイッチ) ----

/** 器になった後の外枠: ヘッダーを描かず、子の領域が上の余白で AdminPage の固定の行の高さを空ける(利用者の枠と同じ形) */
const CONTAINER_OUTER = BEFORE_OUTER.replace(BEFORE_LOGO_PRELOAD, "")
  .replace(BEFORE_HEADER, "")
  .replace(' style="--app-header-height:0px"', "")
  .replace('<div class="flex-1 min-h-0 flex flex-col overflow-clip">', '<div class="flex-1 min-h-0 flex flex-col overflow-clip pt-[var(--app-header-height,0px)]">');
/**
 * 今の AdminHeader の行 = 前の Header の DOM から受け口の id 3 つを除き、行の高さを決まった値(--admin-header-row-height)に固定し
 * (はみ出しは切る)、ロゴの箱の大きさを読み込みの前から決めた物(高さ + 縦横比。仕上がりの大きさは前と同じ)
 */
const HEADER = BEFORE_HEADER.replace(/ id="admin-header-(?:title|center|right)-slot"/g, "")
  .replace('class="flex items-center justify-between gap-3 px-4 ', 'class="flex h-[var(--admin-header-row-height)] items-center justify-between gap-3 overflow-clip px-4 ')
  .replace('class="block h-auto w-auto max-h-6 max-w-[120px] dark:hidden sm:max-h-12 sm:max-w-[300px]"', 'class="block aspect-[300/61] h-6 w-auto dark:hidden sm:h-12"')
  .replace('class="hidden h-auto w-auto max-h-6 max-w-[120px] dark:block sm:max-h-12 sm:max-w-[300px]"', 'class="hidden aspect-[300/61] h-6 w-auto dark:block sm:h-12"')
  // 横幅のはみ出しの決まり: 中央は中で切る、右の操作は SP だけ縮む(PC は縮めない)、明暗の切り替えは縮めない
  .replace('class="flex min-w-0 flex-1 items-center justify-center"', 'class="flex min-w-0 flex-1 items-center justify-center overflow-hidden"')
  .replace('<div class="flex shrink-0 items-center gap-3"><div data-slot="admin-header-right" class="flex items-center gap-3"></div><x-darkmode></x-darkmode>', '<div class="flex min-w-0 shrink-0 items-center gap-3 max-sm:shrink"><div data-slot="admin-header-right" class="flex min-w-0 items-center gap-3"></div><x-darkmode class="shrink-0"></x-darkmode>');
/** AdminPage の行 = HEADER + 置き方のクラス(上端に固定・全幅・header-layer) */
const PAGE_HEADER = HEADER.replace(' sm:px-6 sm:text-lg">', ' sm:px-6 sm:text-lg fixed inset-x-0 top-0 header-layer">');

test("props なしの AdminLayout はヘッダーを描かない器: 前の外枠からヘッダーを除き、子の領域に上の余白だけを足した DOM", () => {
  assert.equal(render(<AdminLayout>CHILD</AdminLayout>), CONTAINER_OUTER);
});

test("ヘッダーの行の高さは決まった値で中身に依らない: 外枠は --app-header-height を inline に書かず(frame.css の初期値 = 行の高さ)、行は actions の有無で同じクラス", () => {
  assert.equal(render(<AdminLayout>CHILD</AdminLayout>).includes("style="), false);
  const plain = page(<AdminPage>CHILD</AdminPage>);
  const withActions = page(<AdminPage actions={<b id="pa" />}>CHILD</AdminPage>);
  const headerOpen = (html: string) => /<header [^>]*>/.exec(html)?.[0];
  assert.equal(headerOpen(withActions), headerOpen(plain));
  assert.match(headerOpen(plain) ?? "", /class="flex h-\[var\(--admin-header-row-height\)\] [^"]*overflow-clip/);
  // ロゴの箱は読み込みの前から大きさを持つ(明示の高さ + 縦横比。自動の高さ・幅の上限だけで決めない)
  for (const img of plain.match(/<img [^>]*>/g) ?? []) {
    assert.match(img, /class="[^"]*aspect-\[300\/61\] h-6 w-auto[^"]* sm:h-12"/, img);
    assert.equal(/h-auto|max-h-/.test(img), false, img);
  }
});

test("className は外枠に足される(slot 化の前と同じ)", () => {
  assert.match(render(<AdminLayout className="invert">CHILD</AdminLayout>), /text-foreground invert"/);
});

// ---- (protected)・insane の sidebar / footer ----

test("props なしの AdminProtectedLayout・InsaneProtectedLayout は slot 化の前と同じ DOM を描く", () => {
  assert.equal(render(<AdminProtectedLayout>CHILD</AdminProtectedLayout>), BEFORE_PROTECTED);
  assert.equal(render(<InsaneProtectedLayout>CHILD</InsaneProtectedLayout>), BEFORE_INSANE);
});

test("sidebar slot に要素を渡すと PC の列と SP のドロワーの両方の殻の中に既定の代わりに描く", () => {
  assert.equal(
    render(<AdminProtectedLayout sidebar={<nav id="s" />}>CHILD</AdminProtectedLayout>),
    BEFORE_PROTECTED.replace('<x-basesidebar data-nav=""></x-basesidebar>', '<nav id="s"></nav>').replace("<x-basesidebar></x-basesidebar>", '<nav id="s"></nav>'),
  );
  assert.equal(
    render(<InsaneProtectedLayout sidebar={<nav id="s" />}>CHILD</InsaneProtectedLayout>),
    BEFORE_INSANE.replace('<x-insanesidebar data-nav=""></x-insanesidebar>', '<nav id="s"></nav>').replace("<x-insanesidebar></x-insanesidebar>", '<nav id="s"></nav>'),
  );
});

test("sidebar = null はサイドバーの殻・リサイズのつまみ・SP の開閉ボタンを描かない", () => {
  for (const html of [
    render(<AdminProtectedLayout sidebar={null}>CHILD</AdminProtectedLayout>),
    render(<InsaneProtectedLayout sidebar={null}>CHILD</InsaneProtectedLayout>),
  ]) {
    assert.ok(!html.includes("navigation-layer"), "SP の殻が残っている");
    assert.ok(!html.includes("hidden md:block"), "PC の殻かつまみが残っている");
    assert.ok(!html.includes("<x-button"), "SP の開閉ボタンが残っている");
    assert.ok(html.includes("CHILD"));
  }
});

test("sidebar の中身は useAdminSidebarFrame() で殻の placement / width を読める", () => {
  const Probe = () => {
    const frame = useAdminSidebarFrame();
    return createElement("x-probe", { "data-placement": frame.placement, "data-width": String(frame.width) });
  };
  const html = render(<AdminProtectedLayout sidebar={<Probe />}>CHILD</AdminProtectedLayout>);
  assert.ok(html.includes('<x-probe data-placement="sp" data-width="192"></x-probe>'));
  assert.ok(html.includes('<x-probe data-placement="pc" data-width="192"></x-probe>'));
  const insane = render(<InsaneProtectedLayout sidebar={<Probe />}>CHILD</InsaneProtectedLayout>);
  assert.ok(insane.includes('data-placement="sp"') && insane.includes('data-placement="pc"'));
  assert.throws(() => render(<Probe />), /サイドバーの殻/);
});

test("footer slot: (protected) は要素で置き換え / null で描かない。insane は既定で無し、要素のときだけ本文の後に描く", () => {
  const footer = BEFORE_PROTECTED.match(/<footer id="footer"[^>]*>[^<]*<\/footer>/)![0];
  assert.equal(render(<AdminProtectedLayout footer={<i id="f" />}>CHILD</AdminProtectedLayout>), BEFORE_PROTECTED.replace(footer, '<i id="f"></i>'));
  assert.equal(render(<AdminProtectedLayout footer={null}>CHILD</AdminProtectedLayout>), BEFORE_PROTECTED.replace(footer, ""));
  assert.equal(render(<InsaneProtectedLayout footer={<i id="f" />}>CHILD</InsaneProtectedLayout>), BEFORE_INSANE.replace("CHILD", 'CHILD<i id="f"></i>'));
  assert.equal(render(<InsaneProtectedLayout footer={null}>CHILD</InsaneProtectedLayout>), BEFORE_INSANE);
});

// ---- AdminPage(ヘッダーの行)・PageTitle ----

// Main 自身の data-slot(main・main-layout・main-container)は Main の持ち物(src/components/Layout/Main.tsx)なので除いて比べる
const page = (node: ReactNode) => render(node).replace(/ data-slot="main(?:-layout|-container)?"/g, "");

test("props なしの AdminPage = ヘッダーの行(前の Header と同じ DOM + 固定の置き方)+ 前と同じ Main。tabs は本文の前に mb-6", () => {
  assert.equal(page(<AdminPage>CHILD</AdminPage>), BEFORE_LOGO_PRELOAD + PAGE_HEADER + BEFORE_PAGE);
  assert.equal(
    page(<AdminPage tabs={<i id="t" />}>CHILD</AdminPage>),
    BEFORE_LOGO_PRELOAD + PAGE_HEADER + BEFORE_PAGE.replace(">CHILD<", '><div class="mb-6"><i id="t"></i></div>CHILD<'),
  );
  assert.ok(!BEFORE_PAGE.includes("data-admin-fill"));
});

/** title="T" の本文側(h1 1 つ。SP で見え、PC は sm:sr-only)= 前の PageTitle の本文の大見出しの見た目 + sm:sr-only */
const TITLE_BODY = BEFORE_TITLE_PAGE.replace("mb-8 sm:text-3xl", "mb-8 sm:text-3xl sm:sr-only");
/** title="T" のヘッダー側 = 前の PageTitle の圧縮の題と同じクラスの飾りの文字(h1 ではない、aria-hidden) */
const TITLE_COMPACT = `<p title="T" aria-hidden="true" class="relative min-w-0 text-base font-semibold tracking-tight text-foreground sm:text-lg after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-[&#x27;&#x27;] animate-in fade-in slide-in-from-left-2 duration-200"><span class="block max-w-[40vw] truncate">T</span></p>`;

test("AdminPage title = ページの題: h1 は本文の先頭の 1 つ(SP は大見出し、PC は sm:sr-only)、PC で見える圧縮の題はヘッダーの題の受け口の中の飾りの文字", () => {
  const html = page(<AdminPage title="T" tabs={<i id="t" />}>CHILD</AdminPage>);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, "h1 は 1 つ");
  assert.ok(html.includes(`<div data-slot="admin-header-title" class="hidden min-w-0 shrink items-center border-l border-border/40 pl-4 sm:flex">${TITLE_COMPACT}</div>`), html);
  assert.ok(html.includes(`<main data-component="Main" id="main" class="max-w-screen overflow-hidden mx-auto w-full p-4 sm:p-6 py-6 sm:py-10">${TITLE_BODY}<div class="mb-6"><i id="t"></i></div>CHILD</main>`), "題は本文の先頭(タブの前)");
  // 見た目の元: 前の PageTitle placement="header" の本文側(sm:hidden)と同じクラスに、PC で消す手段だけ sm:sr-only に替えた物
  assert.equal(TITLE_BODY.replace(" sm:sr-only", " sm:hidden"), BEFORE_TITLE_HEADER);
});

test("AdminPage の center / actions は行の中央・右の位置(data-slot admin-header-center / -right の要素)に描く", () => {
  const html = page(
    <AdminPage center={<b id="pc" />} actions={<b id="pa" />}>
      CHILD
    </AdminPage>,
  );
  assert.ok(html.includes('<div data-slot="admin-header-center" class="flex min-w-0 flex-1 items-center justify-center overflow-hidden"><b id="pc"></b></div>'));
  assert.ok(html.includes('<div data-slot="admin-header-right" class="flex min-w-0 items-center gap-3"><b id="pa"></b></div><x-darkmode class="shrink-0"></x-darkmode>'));
  const withoutProps = html.replace('<b id="pc"></b>', "").replace('<b id="pa"></b>', "");
  assert.equal(withoutProps, BEFORE_LOGO_PRELOAD + PAGE_HEADER + BEFORE_PAGE, "props の中身のほかは props なしと同じ DOM");
});

test("main={false} + title: ヘッダーの題に加え、本文の大見出しは children の前(login・setup の自分のスクロール領域の上)", () => {
  const html = page(<AdminPage main={false} title="T">CHILD</AdminPage>);
  assert.ok(html.endsWith(`</header>${TITLE_BODY}CHILD`), html);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
});

test("main={false} はヘッダーの行だけを描き、children をそのまま続ける(login・setup 用)", () => {
  assert.equal(page(<AdminPage main={false}>CHILD</AdminPage>), BEFORE_LOGO_PRELOAD + PAGE_HEADER + "CHILD");
});

test("AdminHeader は 1 行スイッチ(./AdminHeader.default を指す re-export 1 文)。行は data-slot admin-header・-title・-center・-right を持ち、受け口の id は無い", () => {
  const sw = readFileSync(join(__dirname, "AdminHeader.tsx"), "utf8").replace(/^\s*\/\/.*$/gm, "").trim();
  assert.equal(sw, 'export { AdminHeader, type AdminHeaderProps } from "./AdminHeader.default";');
  const html = render(<AdminHeader />);
  assert.equal(html, BEFORE_LOGO_PRELOAD + HEADER);
  for (const slot of ["admin-header", "admin-header-title", "admin-header-center", "admin-header-right"]) {
    assert.ok(html.includes(`data-slot="${slot}"`), slot);
  }
  assert.equal(/-slot"/.test(html), false, "受け口の id が残っている");
  // AdminLayout に header の prop は無い(差し替えの口は AdminHeader のスイッチだけ)
  assert.equal(/\bheader\?:/.test(readFileSync(join(__dirname, "AdminLayout.tsx"), "utf8")), false);
});

// ---- 行の横幅のはみ出しの決まり(order 22 AMENDMENT 1 (2)。画面ごとの対応はしない) ----

/** class 属性の中身を語の集まりで返す(data-slot で要素を探す) */
const classesOf = (html: string, pattern: RegExp) => {
  const m = html.match(pattern);
  assert.ok(m, `見つからない: ${pattern}`);
  return new Set(m[1].split(/\s+/));
};
const hasAll = (set: Set<string>, words: string[]) => {
  for (const w of words) assert.ok(set.has(w), `${w} が無い: ${[...set].join(" ")}`);
};

test("行のはみ出しの決まり: ロゴと明暗の切り替えは縮めない / 題・中央は縮む(題は … で省く)/ 右の操作は SP だけ縮み PC は縮めない", () => {
  const html = page(<AdminPage title="T" center={<b id="pc" />} actions={<b id="pa" />}>CHILD</AdminPage>);
  hasAll(classesOf(html, /<a class="([^"]*)" href="\/admin">/), ["shrink-0"]);
  hasAll(classesOf(html, /data-slot="admin-header-title" class="([^"]*)"/), ["min-w-0", "shrink"]);
  hasAll(classesOf(html, /<p title="T" aria-hidden="true" class="([^"]*)"/), ["min-w-0"]);
  hasAll(classesOf(html, /<span class="([^"]*)">T<\/span>/), ["truncate", "block"]);
  hasAll(classesOf(html, /data-slot="admin-header-center" class="([^"]*)"/), ["min-w-0", "flex-1", "overflow-hidden"]);
  const right = classesOf(html, /<div class="([^"]*)"><div data-slot="admin-header-right"/);
  hasAll(right, ["min-w-0", "shrink-0", "max-sm:shrink"]);
  assert.equal(right.has("sm:shrink"), false, "PC で右の操作が縮む");
  hasAll(classesOf(html, /data-slot="admin-header-right" class="([^"]*)"/), ["min-w-0"]);
  hasAll(classesOf(html, /<x-darkmode class="([^"]*)">/), ["shrink-0"]);
});

test("名前のとても長い項目の編集: 明暗の切り替えは行の中・操作の後に描き、選択欄は SP だけ最小幅を外して … で省く(ラベルは SP で見た目だけ隠す)、PC の大きさは前のまま", () => {
  const html = page(
    <AdminPage title="T" actions={<AdminEditItemNavigator domain={{ singular: "sample", plural: "samples" } as never} current={{ id: "a" }} />}>
      CHILD
    </AdminPage>,
  );
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>") + "</header>".length);
  // 切り替えは行の中、右の操作の後(行の外や操作の前に押し出されない)
  const right = header.indexOf('data-slot="admin-header-right"');
  const sw = header.indexOf("<x-darkmode");
  assert.ok(right > 0 && sw > right, header);
  assert.ok(header.indexOf("<button", right) < sw, "選択欄は切り替えの前");
  // 選択欄(SelectTrigger): PC の幅(160〜240px)は前のまま、SP だけ縮んで値を … で省く
  const trigger = classesOf(header, /<button[^>]* class="([^"]*)"/);
  hasAll(trigger, [
    "min-w-[160px]",
    "max-w-[240px]",
    "max-sm:!h-8",
    "max-sm:py-0",
    "max-sm:min-w-0",
    "max-sm:max-w-none",
    "max-sm:*:data-[slot=select-value]:block",
    "max-sm:*:data-[slot=select-value]:min-w-0",
    "max-sm:*:data-[slot=select-value]:truncate",
  ]);
  // ラベル「切り替え」は SP で見た目だけ隠す(読み上げには残る)。PC は出す
  hasAll(classesOf(header, /<span class="([^"]*)">切り替え<\/span>/), ["shrink-0", "max-sm:sr-only"]);
});
