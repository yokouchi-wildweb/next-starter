// User 枠の部品(Header・BottomNav・UserPage・Layout/Main)の slot / props と、守る印・属性(data-slot・寸法変数)の検査。
// 全 Tier で見るのは印・属性を含むかの判定。fork の config の値や無害な追加で落とさない。固定の HTML は upstream(Tier1)でだけ見る。
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
      navItems: [],
      logoLink: "/",
      showIcons: false,
      isMenuOpen: true,
      openMenu: () => {},
      closeMenu: () => {},
      toggleMenu: () => {},
      headerRef: { current: null },
      headerOffset: 0,
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
  namedExports: { useBottomNavItems: () => ({ items: navItems.current, height: 64 }) },
});

let render: (node: ReactNode) => string;
let UserNavigation: typeof import("./Header").UserNavigation;
let UserBottomNav: typeof import("./BottomNav").UserBottomNav;
let isBottomNavMenuItem: typeof import("./BottomNav/types").isBottomNavMenuItem;
let BottomNavSpacer: typeof import("./BottomNav/BottomNavSpacer").BottomNavSpacer;
let BottomNavMenu: typeof import("./BottomNav/BottomNavMenu").BottomNavMenu;
let UserPage: typeof import("./UserPage").UserPage;
let Main: typeof import("@/components/Layout/Main").Main;
let USER_PAGE_CONTAINER_TYPE: typeof import("@/config/ui/user-layout.config").USER_PAGE_CONTAINER_TYPE;
let ACTIVE_COLOR_TYPE: typeof import("@/config/ui/user-bottom-menu.config").ACTIVE_COLOR_TYPE;
before(async () => {
  ({ ACTIVE_COLOR_TYPE } = await import("@/config/ui/user-bottom-menu.config"));
  ({ USER_PAGE_CONTAINER_TYPE } = await import("@/config/ui/user-layout.config"));
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ UserNavigation } = await import("./Header"));
  ({ UserBottomNav } = await import("./BottomNav"));
  ({ isBottomNavMenuItem } = await import("./BottomNav/types"));
  ({ BottomNavSpacer } = await import("./BottomNav/BottomNavSpacer"));
  ({ BottomNavMenu } = await import("./BottomNav/BottomNavMenu"));
  ({ UserPage } = await import("./UserPage"));
  ({ Main } = await import("@/components/Layout/Main"));
});

// upstream(Tier1)だけで見る検査の判定(screens.test と同じ)。Header・Main の固定の class は upstream の「DOM を変えない」保証で、
// fork が部品を自分で変えていても fork の test は落とさない(UserPage が Main に正しく渡すことは全 Tier で見る)
const { loadCatalogOwnership } = require("../../../lib/folderCatalog/catalog.mjs") as typeof import("../../../lib/folderCatalog/catalog.mjs");
const isUpstreamRoot = loadCatalogOwnership({ repoRoot: join(__dirname, "../../../.."), folder: "src/lib" }).isRoot;
const tier1Only = { skip: isUpstreamRoot ? false : "fork(Tier1 以外)は upstream の部品を自分で変えうるので、固定の class は見ない" };

/**
 * 部品 slot 化の前(be9747fd)の部品を同じモックで描いた HTML。既定の DOM・id・class・順序の基準(Tier1 のみ)
 * header = <UserNavigation /> / userPage = <UserPage>CHILD</UserPage>(= <Main>CHILD</Main>)。Main には data-slot と safe-area の区切り(指令 10)で data-slot を足した
 */
const BEFORE = {
  header: "<header id=\"header\" class=\"fixed shadow inset-x-0 top-0 header-layer border-b border-border bg-header text-header-foreground \"><div id=\"header-shell\" class=\"mx-auto flex w-full max-w-6xl items-stretch justify-between px-4 py-2 sm:py-4\"><div id=\"header-left\" class=\"flex items-center\"><x-brand></x-brand></div><div id=\"header-center\" class=\"flex items-stretch\"><x-pcnav></x-pcnav></div><div id=\"header-right\" class=\"flex items-center gap-2\"><button data-slot=\"button\" class=\"cursor-pointer items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive disabled:pointer-events-auto disabled:cursor-not-allowed bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 rounded-md gap-1.5 px-3 min-w-16 hidden sm:inline-flex\">お問い合わせ</button><x-spswitch></x-spswitch></div></div><x-spnav><button data-slot=\"button\" class=\"inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive disabled:pointer-events-auto disabled:cursor-not-allowed bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-10 px-4 py-2 min-w-20 w-full\">お問い合わせ</button></x-spnav></header>",
  userPage: "<div data-component=\"Main:container\" data-slot=\"main-container\" id=\"main-container\" class=\"flex flex-1 flex-col\"><div data-component=\"Main:layout\" data-slot=\"main-layout\" id=\"main-layout\" class=\"my-auto mx-auto w-full max-w-screen overflow-clip\" style=\"max-width:var(--layout-width-content-shell)\"><main data-component=\"Main\" data-slot=\"main\" id=\"main\" class=\"mx-auto w-full p-3 sm:p-4\">CHILD</main></div></div>",
  mainSurface: "<div data-component=\"Main:container\" data-slot=\"main-container\" id=\"main-container\" class=\"flex flex-1 flex-col\"><div data-component=\"Main:layout\" data-slot=\"main-layout\" id=\"main-layout\" class=\"my-auto max-w-screen overflow-clip bg-surface mx-auto w-full p-3 sm:p-4\" style=\"max-width:var(--layout-width-content-shell)\"><main data-component=\"Main\" data-slot=\"main\" id=\"main\" class=\"mx-auto w-full\" style=\"max-width:var(--layout-width-narrow-stack)\">CHILD</main></div></div>",
  mainPlain: "<main data-component=\"Main\" data-slot=\"main\" id=\"main\" class=\"max-w-screen overflow-hidden mx-auto w-full p-3 sm:p-4\">CHILD</main>",
} as const;

const CTA = "お問い合わせ";
const count = (html: string, part: string) => html.split(part).length - 1;
/** id の要素の開始タグ(属性の並びに依らず印・属性を見る) */
const tagOf = (html: string, id: string) => html.match(new RegExp(`<[a-z][^>]*\\sid="${id}"[^>]*>`))?.[0] ?? "";
const hasClass = (tag: string, name: string) => (tag.match(/\sclass="([^"]*)"/)?.[1] ?? "").split(/\s+/).includes(name);
/** parts がこの順で html に現れる(間に無害な要素があってもよい) */
const assertInOrder = (html: string, parts: readonly string[]) => {
  let from = 0;
  for (const part of parts) {
    const at = html.indexOf(part, from);
    assert.ok(at >= 0, `順に現れない: ${part}`);
    from = at + part.length;
  }
};

/**
 * 寸法変数の区切り(notice frame-dims)で既定の Header に入った差分はこの 1 か所だけ:
 * top-0 → top-[var(--app-banner-height,0px)](banner が無い時の計算値は同じ 0)
 */
const BEFORE_HEADER_DIMS = BEFORE.header.replace(" top-0 ", " top-[var(--app-banner-height,0px)] ");

/**
 * 枠の印の区切り(notice frame-marks)で既定の部品に入った差分は、外側の要素の data-frame-part だけ
 * (隠す CSS の狙う先。styles/core/frame.css)。ナビの部品(Pc / Sp)はここではモック
 */
const BEFORE_HEADER_MARKS = BEFORE_HEADER_DIMS.replace('<header id="header" ', '<header id="header" data-slot="header" ')
  // 寸法変数の 0 と context 離れの区切り(notice frame-marks-dims): context の表示クラス(既定 "")を外したので class の末尾の空白が無くなった
  .replace(' text-header-foreground ">', ' text-header-foreground pt-[max(0px,calc(var(--app-safe-area-top)_-_var(--app-banner-height,0px)))] pl-[var(--app-safe-area-left)] pr-[var(--app-safe-area-right)]">')
  // data-slot と safe-area の区切り(指令 10): 部位の印は data-slot(data-frame-part をやめた)、ヘッダーは上と左右の切り欠きを避ける(上の class。切り欠きの無い画面では 0)
  .replace('<div id="header-shell" ', '<div id="header-shell" data-slot="header-shell" ')
  .replace('<div id="header-left" ', '<div id="header-left" data-slot="header-left" ')
  .replace('<div id="header-center" ', '<div id="header-center" data-slot="header-center" ')
  .replace('<div id="header-right" ', '<div id="header-right" data-slot="header-right" ');

test("Header は data-slot の印と banner 分の top を持つ", () => {
  const header = tagOf(render(<UserNavigation />), "header");
  assert.ok(header.includes('data-slot="header"'));
  assert.ok(hasClass(header, "top-[var(--app-banner-height,0px)]"));
});

test("props なしの UserNavigation は slot 化の前と同じ DOM を描く(差分は banner 分の top・data-slot・切り欠きの padding だけ。固定の HTML、Tier1 のみ)", tier1Only, () => {
  assert.notEqual(BEFORE_HEADER_DIMS, BEFORE.header);
  assert.notEqual(BEFORE_HEADER_MARKS, BEFORE_HEADER_DIMS);
  assert.equal(render(<UserNavigation />), BEFORE_HEADER_MARKS);
});

test("leading はブランドの前(#header-left の先頭)に描く", () => {
  const html = render(<UserNavigation leading={<i id="back" />} />);
  assertInOrder(html, ['id="header-left"', '<i id="back">', "<x-brand>", 'id="header-center"']);
  assert.equal(count(html, CTA), 2, "既定の CTA 2 つは残る");
});

test("actions はヘッダー右の CTA を置き換え、SP メニューの開閉ボタンの前に描く(SP メニュー下部は既定のまま)", () => {
  const html = render(<UserNavigation actions={<i id="bell" />} />);
  assertInOrder(html, ['id="header-right"', '<i id="bell">', "<x-spswitch>"]);
  assert.equal(count(html, CTA), 1);
  assertInOrder(html, ["<x-spnav>", CTA, "</x-spnav>"]);
});

test("menuActions は SP メニュー下部の CTA を置き換える(ヘッダー右は既定のまま)", () => {
  const html = render(<UserNavigation menuActions={<i id="settings" />} />);
  assertInOrder(html, ["<x-spnav>", '<i id="settings">', "</x-spnav>"]);
  assert.equal(count(html, CTA), 1);
  assertInOrder(html, ['id="header-right"', CTA, "<x-spswitch>"]);
});

test("actions / menuActions に null を渡すとその CTA を描かない", () => {
  const noActions = render(<UserNavigation actions={null} />);
  assert.equal(count(noActions, CTA), 1);
  assertInOrder(noActions, ["<x-spswitch>", "<x-spnav>", CTA]);
  const noMenuActions = render(<UserNavigation menuActions={null} />);
  assert.equal(count(noMenuActions, CTA), 1);
  assertInOrder(noMenuActions, [CTA, "<x-spswitch>", "<x-spnav>"]);
  assert.equal(count(render(<UserNavigation actions={null} menuActions={null} />), CTA), 0);
});

/** リンク項目 2 つの BottomNav の契約: 印・項目の id / href / 並び、カレント(/items)だけが config の色 */
const assertLinkItems = (html: string) => {
  assert.ok(tagOf(html, "bottom-nav").includes('data-slot="bottom-nav"'));
  assertInOrder(html, ['id="bottom-nav"', 'id="bottom-nav-item-game"', "ゲーム", 'id="bottom-nav-item-items"', "<i>1</i>", "商品"]);
  const active = `text-${ACTIVE_COLOR_TYPE}`;
  const game = tagOf(html, "bottom-nav-item-game");
  assert.ok(game.includes('href="/game"'));
  assert.ok(game.includes('data-slot="bottom-nav-item"'));
  assert.ok(hasClass(game, "text-muted-foreground"));
  assert.equal(hasClass(game, active), false);
  const items = tagOf(html, "bottom-nav-item-items");
  assert.ok(items.includes('href="/items"'));
  assert.ok(hasClass(items, active), `カレントが ${active} でない(config の ACTIVE_COLOR_TYPE)`);
  assert.equal(hasClass(items, "text-muted-foreground"), false);
};

test("type 省略のリンク項目だけの BottomNav は印と項目を描き、カレントは config の色(type: \"link\" の明示も同じ)", () => {
  navItems.current = LINK_ITEMS;
  const html = render(<UserBottomNav />);
  assertLinkItems(html);
  navItems.current = LINK_ITEMS.map((item) => ({ ...item, type: "link" as const }));
  assert.equal(render(<UserBottomNav />), html, "type: \"link\" の明示も同じ");
  navItems.current = LINK_ITEMS;
});

test("type: \"menu\" の項目はボタン(メニューを開くトリガー)で描き、カレントにしない", () => {
  navItems.current = [
    ...LINK_ITEMS,
    { type: "menu", key: "create", label: "作成", menuTitle: "作成する", icon: Icon, menu: [{ key: "post", label: "投稿", href: "/items" }] },
  ];
  const html = render(<UserBottomNav />);
  navItems.current = LINK_ITEMS;
  assertLinkItems(html);
  const create = tagOf(html, "bottom-nav-item-create");
  assert.ok(create.startsWith("<button"), "メニュー項目はボタン");
  assert.ok(create.includes('type="button"') && create.includes('aria-label="作成する"'));
  assertInOrder(html, ['id="bottom-nav-item-items"', 'id="bottom-nav-item-create"', 'id="bottom-nav-label-create"', "作成"]);
  assert.equal(hasClass(create, `text-${ACTIVE_COLOR_TYPE}`), false, "メニュー項目はカレント色にならない");
  assert.equal(html.includes('href="/items"', html.indexOf("bottom-nav-item-create")), false, "メニューの中身は閉じた状態では描かない");
});

test("isBottomNavMenuItem は type で判別する(省略 = リンク)", () => {
  assert.equal(isBottomNavMenuItem({ key: "a", label: "A", href: "/", icon: Icon }), false);
  assert.equal(isBottomNavMenuItem({ type: "link", key: "a", label: "A", href: "/", icon: Icon }), false);
  assert.equal(isBottomNavMenuItem({ type: "menu", key: "a", label: "A", icon: Icon, menu: [] }), true);
});

test("props なしの UserPage は config の USER_PAGE_CONTAINER_TYPE の幅の Main を描き、safeArea は切り欠きの変数の padding を足すだけ", () => {
  assert.equal(render(<UserPage>CHILD</UserPage>), render(<Main containerType={USER_PAGE_CONTAINER_TYPE}>CHILD</Main>));
  assert.equal(render(<UserPage verticalAlign="center">CHILD</UserPage>), render(<Main containerType={USER_PAGE_CONTAINER_TYPE}>CHILD</Main>));
  const safe = render(<UserPage containerType="plain" safeArea className="x">CHILD</UserPage>);
  assert.match(safe, /class="[^"]*pt-\[var\(--app-safe-area-top\)\][^"]*pl-\[var\(--app-safe-area-left\)\] x"/);
  assert.equal(render(<UserPage>CHILD</UserPage>).includes("safe-area"), false);
});

test("props なしの UserPage・Main は slot 化の前と同じ DOM を描く(core の Main の固定の class、Tier1 のみ)", tier1Only, () => {
  assert.equal(USER_PAGE_CONTAINER_TYPE, "contentShell", "upstream の config の既定は contentShell");
  assert.equal(render(<UserPage>CHILD</UserPage>), BEFORE.userPage);
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

test("UserPage は containerType の明示が既定より勝つ", () => {
  assert.equal(render(<UserPage containerType="narrowStack">CHILD</UserPage>), render(<Main containerType="narrowStack">CHILD</Main>));
});

test("BottomNavSpacer は高さ変数を読む 1 要素(sp/pc の px 2 本をやめた。隠す間は styles/core/frame.css が変数を 0 にする)", () => {
  const spacer = tagOf(render(<BottomNavSpacer />), "bottom-nav-spacer");
  assert.ok(spacer.includes('data-slot="bottom-nav"'), "スペーサーは部位の印 bottom-nav を持つ(data-slot だけで隠せる)");
  assert.ok(hasClass(spacer, "h-[var(--app-bottom-nav-height,0px)]"));
  assert.ok(spacer.includes('aria-hidden="true"'));
});

test("BottomNavMenu の side の省略は今の DOM のまま(= 上向き side=\"top\" の明示と同じ)。向きの受け渡しは BottomNav/BottomNavMenu.test.tsx", () => {
  const item = { type: "menu" as const, key: "create", label: "作成", icon: Icon, menu: [{ key: "post", label: "投稿", href: "/items" }] };
  const trigger = <button type="button" id="t">T</button>;
  const html = render(<BottomNavMenu item={item} trigger={trigger} />);
  assert.ok(html.includes('id="t"'));
  assert.equal(html, render(<BottomNavMenu item={item} trigger={trigger} side="top" />));
});
