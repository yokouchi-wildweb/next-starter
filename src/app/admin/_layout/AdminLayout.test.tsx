// 管理画面の枠(AdminLayout・AdminProtectedLayout・InsaneProtectedLayout・AdminHeaderSlots)とページ枠部品(AdminPage・PageTitle)の
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

import {
  ADMIN_HEADER_CENTER_SLOT_ID,
  ADMIN_HEADER_RIGHT_SLOT_ID,
  ADMIN_HEADER_TITLE_SLOT_ID,
  APP_HEADER_ELEMENT_ID,
} from "@/components/AppFrames/constants";
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
const headerHeight: { current: number | null } = { current: 0 };
mock.module("@/hooks/useHeaderHeight", { namedExports: { useHeaderHeight: () => headerHeight.current } });
mock.module("@/components/Fanctional/DarkModeSwitch", { namedExports: { DarkModeSwitch: marker("darkmode") } });
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
let AdminHeaderSlots: typeof import("./HeaderSlots").AdminHeaderSlots;
let Header: typeof import("./Header").Header;
let useAdminSidebarFrame: typeof import("./Sidebar/AdminSidebarFrame").useAdminSidebarFrame;
let AdminProtectedLayout: typeof import("../(protected)/_layout/AdminProtectedLayout").AdminProtectedLayout;
let InsaneProtectedLayout: typeof import("../insane/_layout").InsaneProtectedLayout;
let AdminPage: typeof import("./AdminPage").default;
let PageTitle: typeof import("./PageTitle").default;
before(async () => {
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ AdminLayout } = await import("./AdminLayout"));
  ({ AdminHeaderSlots } = await import("./HeaderSlots"));
  ({ Header } = await import("./Header"));
  ({ useAdminSidebarFrame } = await import("./Sidebar/AdminSidebarFrame"));
  ({ AdminProtectedLayout } = await import("../(protected)/_layout/AdminProtectedLayout"));
  ({ InsaneProtectedLayout } = await import("../insane/_layout"));
  AdminPage = (await import("./AdminPage")).default;
  PageTitle = (await import("./PageTitle")).default;
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
const BEFORE_HEADER = `<header id="header" data-slot="admin-header" class="flex items-center justify-between gap-3 px-4 py-[var(--admin-header-padding-y)] text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:text-lg"><a class="block shrink-0 p-1 sm:p-2" href="/admin">${LOGO_IMG("dark", "管理画面ロゴ（ライトモード）", "block h-auto w-auto max-h-6 max-w-[120px] dark:hidden sm:max-h-12 sm:max-w-[300px]")}${LOGO_IMG("light", "管理画面ロゴ（ダークモード）", "hidden h-auto w-auto max-h-6 max-w-[120px] dark:block sm:max-h-12 sm:max-w-[300px]")}</a><div id="admin-header-title-slot" data-slot="admin-header-title" class="hidden min-w-0 shrink items-center border-l border-border/40 pl-4 sm:flex"></div><div id="admin-header-center-slot" data-slot="admin-header-center" class="flex min-w-0 flex-1 items-center justify-center"></div><div class="flex shrink-0 items-center gap-3"><div id="admin-header-right-slot" data-slot="admin-header-right" class="flex items-center gap-3"></div><x-darkmode></x-darkmode></div></header>`;
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

// ---- AdminLayout(外枠)と header slot ----

/** 器になった後の外枠: ヘッダーを描かず、子の領域が上の余白で AdminPage の固定の行の高さを空ける(利用者の枠と同じ形) */
const CONTAINER_OUTER = BEFORE_OUTER.replace(BEFORE_LOGO_PRELOAD, "")
  .replace(BEFORE_HEADER, "")
  .replace('<div class="flex-1 min-h-0 flex flex-col overflow-clip">', '<div class="flex-1 min-h-0 flex flex-col overflow-clip pt-[var(--app-header-height,0px)]">');
/** AdminPage の行 = 前の Header と同じ DOM + 置き方のクラス(上端に固定・全幅・header-layer) */
const PAGE_HEADER = BEFORE_HEADER.replace(' sm:px-6 sm:text-lg">', ' sm:px-6 sm:text-lg fixed inset-x-0 top-0 header-layer">');

test("props なしの AdminLayout はヘッダーを描かない器: 前の外枠からヘッダーを除き、子の領域に上の余白だけを足した DOM", () => {
  assert.equal(render(<AdminLayout>CHILD</AdminLayout>), CONTAINER_OUTER);
});

test("header slot(指令 17 までの差し替えの口): 要素 = 前と同じ位置(流れの中、上の余白なし)に描く / null = 描かない", () => {
  const replaced = render(<AdminLayout header={<header id="h" />}>CHILD</AdminLayout>);
  assert.equal(replaced, BEFORE_OUTER.replace(BEFORE_LOGO_PRELOAD, "").replace(BEFORE_HEADER, '<header id="h"></header>'));
  const none = render(<AdminLayout header={null}>CHILD</AdminLayout>);
  assert.equal(none, BEFORE_OUTER.replace(BEFORE_LOGO_PRELOAD, "").replace(BEFORE_HEADER, ""));
});

test("--app-header-height は測れた時だけ外枠の inline に書く(null = 測る前 = 書かず、frame.css の初期値が効く)", () => {
  try {
    headerHeight.current = null;
    const before = render(<AdminLayout>CHILD</AdminLayout>);
    assert.equal(before.includes("style="), false, before);
    assert.equal(before, CONTAINER_OUTER.replace(' style="--app-header-height:0px"', ""));
    headerHeight.current = 88;
    assert.ok(render(<AdminLayout>CHILD</AdminLayout>).includes('style="--app-header-height:88px"'));
  } finally {
    headerHeight.current = 0;
  }
});

test("className は外枠に足される(slot 化の前と同じ)", () => {
  assert.match(render(<AdminLayout className="invert">CHILD</AdminLayout>), /text-foreground invert"/);
});

// ---- 受け口(DOM id の約束) ----

test("既定の Header はヘッダーの id と受け口 3 つの id を描き、受け口は AdminHeaderSlots と同じ DOM", () => {
  for (const id of [APP_HEADER_ELEMENT_ID, ADMIN_HEADER_TITLE_SLOT_ID, ADMIN_HEADER_CENTER_SLOT_ID, ADMIN_HEADER_RIGHT_SLOT_ID]) {
    assert.ok(BEFORE_HEADER.includes(`id="${id}"`), `既定の Header に id="${id}" が無い`);
  }
  const slots = render(<AdminHeaderSlots trailing={<i id="t" />} />);
  const slotsInHeader = render(<AdminHeaderSlots trailing={createElement("x-darkmode")} />);
  assert.ok(BEFORE_HEADER.includes(slotsInHeader), "既定の Header の受け口部分 = AdminHeaderSlots(trailing = DarkModeSwitch)");
  assert.ok(slots.endsWith(`<div id="${ADMIN_HEADER_RIGHT_SLOT_ID}" data-slot="admin-header-right" class="flex items-center gap-3"></div><i id="t"></i></div>`), "trailing は右の受け口の後ろ");
});

test("受け口の id = AdminHeaderPortal と PageTitle placement=header が探す id(AppFrames/constants の値)", () => {
  const html = render(<AdminHeaderSlots />);
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["admin-header-title-slot", "admin-header-center-slot", "admin-header-right-slot"]);
  assert.deepEqual(ids, [ADMIN_HEADER_TITLE_SLOT_ID, ADMIN_HEADER_CENTER_SLOT_ID, ADMIN_HEADER_RIGHT_SLOT_ID]);
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
const TITLE_COMPACT = `<p title="T" aria-hidden="true" class="relative text-base font-semibold tracking-tight text-foreground sm:text-lg after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-[&#x27;&#x27;] animate-in fade-in slide-in-from-left-2 duration-200"><span class="block max-w-[40vw] truncate">T</span></p>`;

test("AdminPage title = ページの題: h1 は本文の先頭の 1 つ(SP は大見出し、PC は sm:sr-only)、PC で見える圧縮の題はヘッダーの題の受け口の中の飾りの文字", () => {
  const html = page(<AdminPage title="T" tabs={<i id="t" />}>CHILD</AdminPage>);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, "h1 は 1 つ");
  assert.ok(html.includes(`<div id="admin-header-title-slot" data-slot="admin-header-title" class="hidden min-w-0 shrink items-center border-l border-border/40 pl-4 sm:flex">${TITLE_COMPACT}</div>`), html);
  assert.ok(html.includes(`<main data-component="Main" id="main" class="max-w-screen overflow-hidden mx-auto w-full p-4 sm:p-6 py-6 sm:py-10">${TITLE_BODY}<div class="mb-6"><i id="t"></i></div>CHILD</main>`), "題は本文の先頭(タブの前)");
  // 見た目の元: 前の PageTitle placement="header" の本文側(sm:hidden)と同じクラスに、PC で消す手段だけ sm:sr-only に替えた物
  assert.equal(TITLE_BODY.replace(" sm:sr-only", " sm:hidden"), BEFORE_TITLE_HEADER);
});

test("AdminPage の center / actions は行の中央・右の受け口の中(今の id・data-slot の要素)に描く", () => {
  const html = page(
    <AdminPage center={<b id="pc" />} actions={<b id="pa" />}>
      CHILD
    </AdminPage>,
  );
  assert.ok(html.includes('<div id="admin-header-center-slot" data-slot="admin-header-center" class="flex min-w-0 flex-1 items-center justify-center"><b id="pc"></b></div>'));
  assert.ok(html.includes('<div id="admin-header-right-slot" data-slot="admin-header-right" class="flex items-center gap-3"><b id="pa"></b></div><x-darkmode></x-darkmode>'));
  const withoutProps = html.replace('<b id="pc"></b>', "").replace('<b id="pa"></b>', "");
  assert.equal(withoutProps, BEFORE_LOGO_PRELOAD + PAGE_HEADER + BEFORE_PAGE, "props の中身のほかは props なしと同じ DOM");
});

test("main={false} + title: ヘッダーの題に加え、本文の大見出しは children の前(login・setup の自分のスクロール領域の上)", () => {
  const html = page(<AdminPage main={false} title="T">CHILD</AdminPage>);
  assert.ok(html.endsWith(`</header>${TITLE_BODY}CHILD`), html);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
});

test("portal の着地(帯を足す段の互換): AdminPage の行の中に受け口の id が題・中央・右の順で 1 つずつあり、AdminHeaderPortal(ItemNavigator の slot も)が探す id と同じ", () => {
  const html = page(<AdminPage>CHILD</AdminPage>);
  const header = /<header id="header" data-slot="admin-header"[^>]*>[\s\S]*<\/header>/.exec(html)?.[0] ?? "";
  const ids = [...header.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["header", ADMIN_HEADER_TITLE_SLOT_ID, ADMIN_HEADER_CENTER_SLOT_ID, ADMIN_HEADER_RIGHT_SLOT_ID]);
  assert.equal(html.split('id="admin-header-title-slot"').length - 1, 1);
  const portal = readFileSync(join(__dirname, "../../../components/AppFrames/Admin/Elements/AdminHeaderPortal.tsx"), "utf8");
  for (const [slot, constant] of [["title", "ADMIN_HEADER_TITLE_SLOT_ID"], ["center", "ADMIN_HEADER_CENTER_SLOT_ID"], ["right", "ADMIN_HEADER_RIGHT_SLOT_ID"]]) {
    assert.ok(portal.includes(`${slot}: ${constant},`), `AdminHeaderPortal の ${slot} が ${constant} を探していない`);
  }
  const navigatorTypes = readFileSync(join(__dirname, "../../../components/AppFrames/Admin/Elements/ItemNavigator/types.ts"), "utf8");
  assert.match(navigatorTypes, /slot\?: "center" \| "right"/, "ItemNavigator の slot は AdminHeaderPortal の center / right");
});

test("main={false} はヘッダーの行だけを描き、children をそのまま続ける(login・setup 用)", () => {
  assert.equal(page(<AdminPage main={false}>CHILD</AdminPage>), BEFORE_LOGO_PRELOAD + PAGE_HEADER + "CHILD");
});

test("AdminLayout の header の prop(差し替え)がある間、AdminPage は行を描かない / 無ければ器の子の AdminPage が行を 1 つ描く", () => {
  const replaced = page(
    <AdminLayout header={<header id="h" />}>
      <AdminPage>CHILD</AdminPage>
    </AdminLayout>,
  );
  assert.equal(replaced.includes('data-slot="admin-header"'), false);
  assert.ok(replaced.includes('<header id="h"></header>') && replaced.includes(BEFORE_PAGE));
  const nothing = page(
    <AdminLayout header={null}>
      <AdminPage>CHILD</AdminPage>
    </AdminLayout>,
  );
  assert.equal(nothing.includes("<header"), false);
  const own = page(
    <AdminLayout>
      <AdminPage>CHILD</AdminPage>
    </AdminLayout>,
  );
  assert.equal(own.split('data-slot="admin-header"').length - 1, 1);
  assert.ok(own.includes(PAGE_HEADER + BEFORE_PAGE));
});

test("互換の Header(props なし)は前の Header と同じ DOM(流れの中に置く形、固定のクラスなし)", () => {
  assert.equal(render(<Header />), BEFORE_LOGO_PRELOAD + BEFORE_HEADER);
});

test("PageTitle の既定は placement=header。placement=page は前の既定と同じ DOM", () => {
  assert.equal(render(<PageTitle>T</PageTitle>), BEFORE_TITLE_HEADER);
  assert.equal(render(<PageTitle placement="header">T</PageTitle>), BEFORE_TITLE_HEADER);
  assert.equal(render(<PageTitle placement="page">T</PageTitle>), BEFORE_TITLE_PAGE);
});
