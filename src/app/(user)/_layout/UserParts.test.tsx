// User 枠の部品(Header・BottomNav・UserPage・Layout/Main)の slot / props と、props なしの描画が部品 slot 化の前と同じことの検査。
// 実行: pnpm test:user-layout(UserLayout.test.tsx と同じ方式: tsx + node:test のモジュールモック + react-dom/server の静的描画)
//
// Header は useHeaderData・Brand・Pc / Sp のナビ部品を目印にモックし、HeaderShell と CTA の Button は本物を描く
// (SpNavigation の目印は footer prop を子として描く = SP メニュー下部に何が渡ったかを見る)。
// BottomNav は useBottomNavItems・next/navigation をモックし、項目の部品は本物を描く(表示制御の context はもう読まない)。
// UserPage の幅の既定が config に従うことは UserPageDefault.test.tsx(config をモックするため別ファイル)。
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement, type ReactNode } from "react";

import type { BottomNavItem, BottomNavLinkItem } from "@/config/ui/user-bottom-menu.config";

const marker = (name: string) => {
  const Marker = ({ footer }: { footer?: ReactNode }) => createElement(`x-${name}`, null, footer);
  Marker.displayName = `Marker(${name})`;
  return Marker;
};
const here = (path: string) => pathToFileURL(join(__dirname, path)).href;

mock.module(here("./hooks/index.ts"), {
  namedExports: {
    useHeaderData: () => ({
      enabled: true,
      navItems: [],
      navEnabled: { sp: true, pc: true },
      visibility: { sp: true, pc: true },
      navVisibility: { sp: true, pc: true },
      logoLink: "/",
      showIcons: false,
      isMenuOpen: true,
      openMenu: () => {},
      closeMenu: () => {},
      toggleMenu: () => {},
      headerRef: { current: null },
      headerOffset: 0,
      visibilityClass: "",
    }),
  },
});
mock.module(here("./Header/Brand.tsx"), { namedExports: { Brand: marker("brand") } });
mock.module(here("./Header/Pc/PcNavigation.tsx"), { namedExports: { PcNavigation: marker("pcnav") } });
mock.module(here("./Header/Sp/SpNavigation.tsx"), { namedExports: { SpNavigation: marker("spnav") } });
mock.module(here("./Header/Sp/SpNavSwitch.tsx"), { namedExports: { SpNavSwitch: marker("spswitch") } });
mock.module("next/navigation", { namedExports: { usePathname: () => "/items", useRouter: () => ({ push: () => {} }) } });

const Icon = ({ className }: { className?: string }) => createElement("x-icon", { class: className });
const LINK_ITEMS: BottomNavLinkItem[] = [
  { key: "game", label: "ゲーム", href: "/game", icon: Icon },
  { key: "items", label: "商品", href: "/items", icon: Icon, badge: createElement("i", null, "1") },
];
const navItems: { current: readonly BottomNavItem[] } = { current: LINK_ITEMS };
mock.module(here("./BottomNav/useBottomNavItems.ts"), {
  namedExports: { useBottomNavItems: () => ({ items: navItems.current, height: 64, enabled: true }) },
});

let render: (node: ReactNode) => string;
let UserNavigation: typeof import("./Header").UserNavigation;
let UserBottomNav: typeof import("./BottomNav").UserBottomNav;
let isBottomNavMenuItem: typeof import("./BottomNav/types").isBottomNavMenuItem;
let BottomNavSpacer: typeof import("./BottomNav/BottomNavSpacer").BottomNavSpacer;
let UserPage: typeof import("./UserPage").UserPage;
let Main: typeof import("@/components/Layout/Main").Main;
let USER_PAGE_CONTAINER_TYPE: typeof import("@/config/ui/user-layout.config").USER_PAGE_CONTAINER_TYPE;
before(async () => {
  ({ USER_PAGE_CONTAINER_TYPE } = await import("@/config/ui/user-layout.config"));
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ UserNavigation } = await import("./Header"));
  ({ UserBottomNav } = await import("./BottomNav"));
  ({ isBottomNavMenuItem } = await import("./BottomNav/types"));
  ({ BottomNavSpacer } = await import("./BottomNav/BottomNavSpacer"));
  ({ UserPage } = await import("./UserPage"));
  ({ Main } = await import("@/components/Layout/Main"));
});

/**
 * 部品 slot 化の前(be9747fd)の部品を同じモックで描いた HTML。既定の DOM・id・class・順序の基準
 * header = <UserNavigation /> / bottomNav = リンク項目 2 つ(/items がカレント)/ userPage = <UserPage>CHILD</UserPage>(= <Main>CHILD</Main>)
 */
const BEFORE = {
  header: "<header id=\"header\" class=\"fixed shadow inset-x-0 top-0 header-layer border-b border-border bg-header text-header-foreground \"><div id=\"header-shell\" class=\"mx-auto flex w-full max-w-6xl items-stretch justify-between px-4 py-2 sm:py-4\"><div id=\"header-left\" class=\"flex items-center\"><x-brand></x-brand></div><div id=\"header-center\" class=\"flex items-stretch\"><x-pcnav></x-pcnav></div><div id=\"header-right\" class=\"flex items-center gap-2\"><button data-slot=\"button\" class=\"cursor-pointer items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive disabled:pointer-events-auto disabled:cursor-not-allowed bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 rounded-md gap-1.5 px-3 min-w-16 hidden sm:inline-flex\">お問い合わせ</button><x-spswitch></x-spswitch></div></div><x-spnav><button data-slot=\"button\" class=\"inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive disabled:pointer-events-auto disabled:cursor-not-allowed bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-10 px-4 py-2 min-w-20 w-full\">お問い合わせ</button></x-spnav></header>",
  bottomNav: "<nav id=\"bottom-nav\" class=\"fixed inset-x-0 bottom-0 z-50 items-center justify-around border-t border-border bg-background shadow-[0_-2px_10px_rgba(0,0,0,0.05)] [&amp;&gt;*:not(:last-child)]:border-r-2 [&amp;&gt;*:not(:last-child)]:border-border/30 flex\" style=\"height:64px;padding-bottom:env(safe-area-inset-bottom)\"><a id=\"bottom-nav-item-game\" class=\"flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors text-muted-foreground\" href=\"/game\"><div class=\"relative\"><x-icon class=\"size-6\"></x-icon></div><span id=\"bottom-nav-label-game\" class=\"text-[10px] font-medium leading-tight\">ゲーム</span></a><a id=\"bottom-nav-item-items\" class=\"flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors text-accent\" href=\"/items\"><div class=\"relative\"><x-icon class=\"size-6\"></x-icon><span class=\"absolute -top-1 -right-1\"><i>1</i></span></div><span id=\"bottom-nav-label-items\" class=\"text-[10px] font-medium leading-tight\">商品</span></a></nav>",
  userPage: "<div data-component=\"Main:container\" id=\"main-container\" class=\"flex flex-1 flex-col\"><div data-component=\"Main:layout\" id=\"main-layout\" class=\"my-auto mx-auto w-full max-w-screen overflow-clip\" style=\"max-width:var(--layout-width-content-shell)\"><main data-component=\"Main\" id=\"main\" class=\"mx-auto w-full p-3 sm:p-4\">CHILD</main></div></div>",
  userPageFill: "<main data-component=\"Main\" id=\"main\" class=\"max-w-screen mx-auto w-full p-0 flex min-h-0 flex-1 flex-col overflow-clip overscroll-none\" data-user-fill=\"\">CHILD</main>",
  mainSurface: "<div data-component=\"Main:container\" id=\"main-container\" class=\"flex flex-1 flex-col\"><div data-component=\"Main:layout\" id=\"main-layout\" class=\"my-auto max-w-screen overflow-clip bg-surface mx-auto w-full p-3 sm:p-4\" style=\"max-width:var(--layout-width-content-shell)\"><main data-component=\"Main\" id=\"main\" class=\"mx-auto w-full\" style=\"max-width:var(--layout-width-narrow-stack)\">CHILD</main></div></div>",
  mainPlain: "<main data-component=\"Main\" id=\"main\" class=\"max-w-screen overflow-hidden mx-auto w-full p-3 sm:p-4\">CHILD</main>",
} as const;

const CTA = "お問い合わせ";
const count = (html: string, part: string) => html.split(part).length - 1;

/**
 * 寸法変数の区切り(notice frame-dims)で既定の Header に入った差分はこの 1 か所だけ:
 * top-0 → top-[var(--app-banner-height,0px)](banner が無い時の計算値は同じ 0)
 */
const BEFORE_HEADER_DIMS = BEFORE.header.replace(" top-0 ", " top-[var(--app-banner-height,0px)] ");

/**
 * 枠の印の区切り(notice frame-marks)で既定の部品に入った差分は、外側の要素の data-frame-part だけ
 * (Hide* の印で隠す CSS の狙う先。styles/_base/frame-controls.generated.css)。ナビの部品(Pc / Sp)はここではモック
 */
const BEFORE_HEADER_MARKS = BEFORE_HEADER_DIMS.replace('<header id="header" ', '<header id="header" data-frame-part="header" ')
  // 寸法変数の 0 と context 離れの区切り(notice frame-marks-dims): context の表示クラス(既定 "")を外したので class の末尾の空白が無くなった
  .replace(' text-header-foreground ">', ' text-header-foreground">');
const BEFORE_BOTTOM_NAV_MARKS = BEFORE.bottomNav.replace('<nav id="bottom-nav" ', '<nav id="bottom-nav" data-frame-part="bottom-nav" ');

test("props なしの UserNavigation は slot 化の前と同じ DOM を描く(差分は banner 分の top と data-frame-part だけ)", () => {
  assert.notEqual(BEFORE_HEADER_DIMS, BEFORE.header);
  assert.notEqual(BEFORE_HEADER_MARKS, BEFORE_HEADER_DIMS);
  assert.equal(render(<UserNavigation />), BEFORE_HEADER_MARKS);
});

test("leading はブランドの前(#header-left の先頭)に描く", () => {
  const html = render(<UserNavigation leading={<i id="back" />} />);
  assert.ok(html.includes('<div id="header-left" class="flex items-center"><i id="back"></i><x-brand></x-brand></div>'));
  assert.equal(count(html, CTA), 2, "既定の CTA 2 つは残る");
});

test("actions はヘッダー右の CTA を置き換え、SP メニューの開閉ボタンの前に描く(SP メニュー下部は既定のまま)", () => {
  const html = render(<UserNavigation actions={<i id="bell" />} />);
  assert.ok(html.includes('<div id="header-right" class="flex items-center gap-2"><i id="bell"></i><x-spswitch></x-spswitch></div>'));
  assert.equal(count(html, CTA), 1);
  assert.match(html, /<x-spnav><button[^>]*w-full">お問い合わせ<\/button><\/x-spnav>/);
});

test("menuActions は SP メニュー下部の CTA を置き換える(ヘッダー右は既定のまま)", () => {
  const html = render(<UserNavigation menuActions={<i id="settings" />} />);
  assert.ok(html.includes('<x-spnav><i id="settings"></i></x-spnav>'));
  assert.equal(count(html, CTA), 1);
  assert.match(html, /hidden sm:inline-flex">お問い合わせ<\/button><x-spswitch>/);
});

test("actions / menuActions に null を渡すとその CTA を描かない", () => {
  assert.ok(render(<UserNavigation actions={null} />).includes('<div id="header-right" class="flex items-center gap-2"><x-spswitch></x-spswitch></div>'));
  assert.ok(render(<UserNavigation menuActions={null} />).includes("<x-spnav></x-spnav>"));
  assert.equal(count(render(<UserNavigation actions={null} menuActions={null} />), CTA), 0);
});

test("type 省略のリンク項目だけの BottomNav は slot 化の前と同じ DOM を描く(差分は data-frame-part だけ)", () => {
  navItems.current = LINK_ITEMS;
  assert.notEqual(BEFORE_BOTTOM_NAV_MARKS, BEFORE.bottomNav);
  assert.equal(render(<UserBottomNav />), BEFORE_BOTTOM_NAV_MARKS);
  navItems.current = LINK_ITEMS.map((item) => ({ ...item, type: "link" as const }));
  assert.equal(render(<UserBottomNav />), BEFORE_BOTTOM_NAV_MARKS, "type: \"link\" の明示も同じ");
  navItems.current = LINK_ITEMS;
});

test("type: \"menu\" の項目はボタン(メニューを開くトリガー)で描き、カレントにしない", () => {
  navItems.current = [
    ...LINK_ITEMS,
    { type: "menu", key: "create", label: "作成", menuTitle: "作成する", icon: Icon, menu: [{ key: "post", label: "投稿", href: "/items" }] },
  ];
  const html = render(<UserBottomNav />);
  navItems.current = LINK_ITEMS;
  assert.ok(html.startsWith(BEFORE_BOTTOM_NAV_MARKS.slice(0, -"</nav>".length)), "リンク項目は今のまま並ぶ");
  assert.match(html, /<button[^>]*id="bottom-nav-item-create" type="button" aria-label="作成する"[^>]*>/);
  assert.ok(html.includes('<span id="bottom-nav-label-create" class="text-[10px] font-medium leading-tight">作成</span>'));
  assert.equal(/id="bottom-nav-item-create"[^>]*text-accent/.test(html), false, "メニュー項目はカレント色にならない");
  assert.equal(html.includes('href="/items"', html.indexOf("bottom-nav-item-create")), false, "メニューの中身は閉じた状態では描かない");
});

test("isBottomNavMenuItem は type で判別する(省略 = リンク)", () => {
  assert.equal(isBottomNavMenuItem({ key: "a", label: "A", href: "/", icon: Icon }), false);
  assert.equal(isBottomNavMenuItem({ type: "link", key: "a", label: "A", href: "/", icon: Icon }), false);
  assert.equal(isBottomNavMenuItem({ type: "menu", key: "a", label: "A", icon: Icon, menu: [] }), true);
});

// upstream(Tier1)だけで見る検査の判定(screens.test と同じ)。core の Main の固定の class は upstream の「DOM を変えない」保証で、
// fork が Main を自分で変えていても fork の test は落とさない(UserPage が Main に正しく渡すことは全 Tier で見る)
const { loadCatalogOwnership } = require("../../../lib/folderCatalog/catalog.mjs") as typeof import("../../../lib/folderCatalog/catalog.mjs");
const isUpstreamRoot = loadCatalogOwnership({ repoRoot: join(__dirname, "../../../.."), folder: "src/lib" }).isRoot;
const tier1Only = { skip: isUpstreamRoot ? false : "fork(Tier1 以外)は core の Main を自分で変えうるので、固定の class は見ない" };

test("props なしの UserPage は config の USER_PAGE_CONTAINER_TYPE の幅の Main を描き、fill は Main の上に充填の class と印を足す", () => {
  assert.equal(render(<UserPage>CHILD</UserPage>), render(<Main containerType={USER_PAGE_CONTAINER_TYPE}>CHILD</Main>));
  assert.equal(render(<UserPage verticalAlign="center">CHILD</UserPage>), render(<Main containerType={USER_PAGE_CONTAINER_TYPE}>CHILD</Main>));
  const fill = render(<UserPage fill>CHILD</UserPage>);
  assert.match(fill, /<main [^>]*data-user-fill=""/);
  assert.match(fill, /class="[^"]*flex min-h-0 flex-1 flex-col overflow-clip overscroll-none[^"]*"/);
});

test("props なしの UserPage・Main は slot 化の前と同じ DOM を描く(core の Main の固定の class、Tier1 のみ)", tier1Only, () => {
  assert.equal(USER_PAGE_CONTAINER_TYPE, "contentShell", "upstream の config の既定は contentShell");
  assert.equal(render(<UserPage>CHILD</UserPage>), BEFORE.userPage);
  assert.equal(render(<UserPage fill>CHILD</UserPage>), BEFORE.userPageFill);
  assert.equal(render(<Main>CHILD</Main>), BEFORE.userPage);
  assert.equal(render(<Main containerType="surfaceDisplay">CHILD</Main>), BEFORE.mainSurface);
  assert.equal(render(<Main containerType="plain">CHILD</Main>), BEFORE.mainPlain);
  assert.equal(render(<Main verticalAlign="center">CHILD</Main>), BEFORE.userPage, "center の明示も同じ");
});

test("Main の verticalAlign=\"start\" は中央寄せ(my-auto)をやめて上揃えにする(UserPage からも渡せる)", () => {
  for (const html of [
    render(<Main verticalAlign="start">CHILD</Main>),
    render(<UserPage verticalAlign="start">CHILD</UserPage>),
    render(<Main containerType="surfaceDisplay" verticalAlign="start">CHILD</Main>),
  ]) {
    assert.equal(html.includes("my-auto"), false);
    assert.match(html, /id="main-layout" class="mt-0 mb-auto /);
  }
  assert.equal(render(<Main containerType="plain" verticalAlign="start">CHILD</Main>), render(<Main containerType="plain">CHILD</Main>), "plain には効かない");
});

test("UserPage は containerType の明示が既定より勝つ(fill の時も)", () => {
  assert.equal(render(<UserPage containerType="narrowStack">CHILD</UserPage>), render(<Main containerType="narrowStack">CHILD</Main>));
  assert.match(render(<UserPage fill containerType="narrowStack">CHILD</UserPage>), /max-width:var\(--layout-width-narrow-stack\)/);
});

test("BottomNavSpacer は高さ変数を読む 1 要素(sp/pc の px 2 本をやめた。隠す間は印の CSS が変数を 0 にする)", () => {
  assert.equal(
    render(<BottomNavSpacer />),
    '<div id="bottom-nav-spacer" data-frame-part="bottom-nav" class="shrink-0 h-[var(--app-bottom-nav-height,0px)]" aria-hidden="true"></div>',
  );
});
