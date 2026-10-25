// 管理画面の枠(AdminLayout・AdminProtectedLayout・InsaneProtectedLayout・AdminHeaderSlots)とページ枠部品(AdminPage・PageTitle)の
// slot / props と、props なしの描画が slot 化の前(a77da63d)と同じことの検査。
// 実行: pnpm test:admin-layout(test:user-layout と同じ方式: tsx + node:test のモジュールモック + react-dom/server の静的描画)
//
// 重い部品(BaseSidebar・InsaneSidebar・DarkModeSwitch・Button)と useHeaderHeight・useAuthSession は目印にモックし、
// 枠そのもの(外枠・Header・受け口・サイドバーの殻・リサイズのつまみ・Footer・並び順)は本物を描く。
// サイドバー幅の調整は有効(APP_FEATURES をモック)= fork の設定値に左右されない。
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
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

mock.module("@/hooks/useHeaderHeight", { namedExports: { useHeaderHeight: () => 0 } });
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
let AdminOuterLayout: typeof import("./AdminOuterLayout").AdminOuterLayout;
let AdminHeaderSlots: typeof import("./HeaderSlots").AdminHeaderSlots;
let useAdminSidebarFrame: typeof import("./Sidebar/AdminSidebarFrame").useAdminSidebarFrame;
let AdminProtectedLayout: typeof import("../(protected)/_layout/AdminProtectedLayout").AdminProtectedLayout;
let InsaneProtectedLayout: typeof import("../insane/_layout").InsaneProtectedLayout;
let AdminPage: typeof import("./AdminPage").default;
let PageTitle: typeof import("./PageTitle").default;
before(async () => {
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ AdminLayout } = await import("./AdminLayout"));
  ({ AdminOuterLayout } = await import("./AdminOuterLayout"));
  ({ AdminHeaderSlots } = await import("./HeaderSlots"));
  ({ useAdminSidebarFrame } = await import("./Sidebar/AdminSidebarFrame"));
  ({ AdminProtectedLayout } = await import("../(protected)/_layout/AdminProtectedLayout"));
  ({ InsaneProtectedLayout } = await import("../insane/_layout"));
  AdminPage = (await import("./AdminPage")).default;
  PageTitle = (await import("./PageTitle")).default;
});

const render = (node: ReactNode) => renderToStaticMarkup(node);
const FOOTER_TEXT = `© ${new Date().getFullYear()} ${businessConfig.serviceName}`;

// ---- slot 化の前(a77da63d)の部品を同じモックで描いた HTML。既定の DOM・id・順序の基準 ----

/** `<AdminOuterLayout>CHILD</AdminOuterLayout>`(旧 admin/layout.tsx が描いていた物)のヘッダー */
const BEFORE_HEADER = `<header id="header" class="flex items-center justify-between gap-3 px-4 py-[var(--admin-header-padding-y)] text-base bg-muted text-muted-foreground shadow-sm font-bold sm:px-6 sm:text-lg"><a class="block shrink-0 p-1 sm:p-2" href="/admin"><img src="${logoPath("dark")}" alt="管理画面ロゴ（ライトモード）" class="block h-auto max-h-6 max-w-[120px] dark:hidden sm:max-h-12 sm:max-w-[300px]"/><img src="${logoPath("light")}" alt="管理画面ロゴ（ダークモード）" class="hidden h-auto max-h-6 max-w-[120px] dark:block sm:max-h-12 sm:max-w-[300px]"/></a><div id="admin-header-title-slot" class="hidden min-w-0 shrink items-center border-l border-border/40 pl-4 sm:flex"></div><div id="admin-header-center-slot" class="flex min-w-0 flex-1 items-center justify-center"></div><div class="flex shrink-0 items-center gap-3"><div id="admin-header-right-slot" class="flex items-center gap-3"></div><x-darkmode></x-darkmode></div></header>`;
/** 既定の Header のロゴ画像が文書の先頭に出す preload(Header を描かないときは出ない) */
const BEFORE_LOGO_PRELOAD = `<link rel="preload" as="image" href="${logoPath("dark")}"/><link rel="preload" as="image" href="${logoPath("light")}"/>`;
/** 同じく外枠全体 */
const BEFORE_OUTER = BEFORE_LOGO_PRELOAD + `<div class="relative flex h-[var(--viewport-height,100dvh)] flex-col overflow-hidden bg-background text-foreground" style="--app-header-height:0px">` + BEFORE_HEADER + `<div class="flex-1 min-h-0 flex flex-col overflow-clip">CHILD</div></div>`;
/** `<AdminProtectedLayout>CHILD</AdminProtectedLayout>` */
const BEFORE_PROTECTED = `<div class="flex h-full min-h-0 relative"><div style="width:192px" class="fixed inset-y-0 right-0 navigation-layer transition-transform md:hidden translate-x-full"><x-basesidebar data-nav=""></x-basesidebar></div><div class="hidden md:block h-full" style="width:192px"><x-basesidebar></x-basesidebar></div><div class="hidden md:block h-full w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"></div><div class="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden"><div data-admin-main-wrapper="true" class="flex-1">CHILD</div><footer id="footer" class="h-12 flex items-center justify-center px-6 bg-background text-foreground shadow-inner text-sm">${FOOTER_TEXT}</footer></div></div><x-button data-variant="accent" aria-label="メニューを開く" aria-pressed="false"></x-button>`;
/** `<InsaneProtectedLayout>CHILD</InsaneProtectedLayout>` */
const BEFORE_INSANE = `<div class="flex flex-1 flex-col min-h-0"><div class="flex flex-1 min-h-0 relative"><div style="width:192px" class="fixed inset-y-0 right-0 navigation-layer transition-transform md:hidden translate-x-full"><x-insanesidebar data-nav=""></x-insanesidebar></div><div class="hidden md:block" style="width:192px"><x-insanesidebar></x-insanesidebar></div><div class="hidden md:block w-1 cursor-ew-resize bg-border hover:bg-muted shrink-0"></div><div class="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden">CHILD</div></div><x-button data-variant="destructive" aria-label="メニューを開く" aria-pressed="false"></x-button></div>`;
/** `<AdminPage>CHILD</AdminPage>` / `<AdminPage fill>CHILD</AdminPage>` */
const BEFORE_PAGE = `<main data-component="Main" id="main" class="max-w-screen overflow-hidden mx-auto w-full p-4 sm:p-6 py-6 sm:py-10">CHILD</main>`;
const BEFORE_PAGE_FILL = `<main data-component="Main" id="main" class="max-w-screen overflow-hidden mx-auto w-full p-0 flex min-h-0 flex-1 flex-col px-[var(--admin-page-padding-inline)] py-[var(--admin-page-padding-block)]" data-admin-fill="">CHILD</main>`;
/** `<PageTitle>T</PageTitle>`(当時の既定 = page)/ `<PageTitle placement="header">T</PageTitle>`(SSR では AdminHeaderPortal は何も描かない) */
const BEFORE_TITLE_PAGE = `<h1 class="tracking-tight text-2xl font-normal text-left relative px-4 py-2 text-foreground bg-gradient-to-tr from-secondary/15 via-secondary/5 to-transparent dark:from-secondary/30 dark:via-secondary/15 dark:to-transparent after:absolute after:left-4 after:-bottom-1 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-[&#x27;&#x27;] mb-8 sm:text-3xl">T</h1>`;
const BEFORE_TITLE_HEADER = `<h1 class="tracking-tight text-2xl font-normal text-left relative px-4 py-2 text-foreground bg-gradient-to-tr from-secondary/15 via-secondary/5 to-transparent dark:from-secondary/30 dark:via-secondary/15 dark:to-transparent after:absolute after:left-4 after:-bottom-1 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-[&#x27;&#x27;] mb-8 sm:text-3xl sm:hidden">T</h1>`;

// ---- AdminLayout(外枠)と header slot ----

test("props なしの AdminLayout は slot 化の前と同じ DOM を描く。互換の AdminOuterLayout も同じ", () => {
  assert.equal(render(<AdminLayout>CHILD</AdminLayout>), BEFORE_OUTER);
  assert.equal(render(<AdminOuterLayout>CHILD</AdminOuterLayout>), BEFORE_OUTER);
});

test("header slot: 要素 = 既定の Header の代わりに同じ位置に描く / null = 描かない", () => {
  const replaced = render(<AdminLayout header={<header id="h" />}>CHILD</AdminLayout>);
  assert.equal(replaced, BEFORE_OUTER.replace(BEFORE_LOGO_PRELOAD, "").replace(BEFORE_HEADER, '<header id="h"></header>'));
  const none = render(<AdminLayout header={null}>CHILD</AdminLayout>);
  assert.equal(none, BEFORE_OUTER.replace(BEFORE_LOGO_PRELOAD, "").replace(BEFORE_HEADER, ""));
});

test("className は外枠に足される(旧 AdminOuterLayout と同じ)", () => {
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
  assert.ok(slots.endsWith(`<div id="${ADMIN_HEADER_RIGHT_SLOT_ID}" class="flex items-center gap-3"></div><i id="t"></i></div>`), "trailing は右の受け口の後ろ");
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

// ---- AdminPage・PageTitle ----

test("props なしの AdminPage は前と同じ DOM。tabs は本文の前に mb-6 で描く(通常・fill)", () => {
  assert.equal(render(<AdminPage>CHILD</AdminPage>), BEFORE_PAGE);
  assert.equal(render(<AdminPage fill>CHILD</AdminPage>), BEFORE_PAGE_FILL);
  assert.equal(render(<AdminPage tabs={<i id="t" />}>CHILD</AdminPage>), BEFORE_PAGE.replace(">CHILD<", '><div class="mb-6"><i id="t"></i></div>CHILD<'));
  assert.equal(
    render(<AdminPage fill tabs={<i id="t" />}>CHILD</AdminPage>),
    BEFORE_PAGE_FILL.replace(">CHILD<", '><div class="mb-6"><i id="t"></i></div>CHILD<'),
  );
});

test("PageTitle の既定は placement=header。placement=page は前の既定と同じ DOM", () => {
  assert.equal(render(<PageTitle>T</PageTitle>), BEFORE_TITLE_HEADER);
  assert.equal(render(<PageTitle placement="header">T</PageTitle>), BEFORE_TITLE_HEADER);
  assert.equal(render(<PageTitle placement="page">T</PageTitle>), BEFORE_TITLE_PAGE);
});
