// UserLayout(ユーザー側の枠の既定の組み立て)の slot と、props なしの描画が 1 行スイッチ化の前と同じことの検査。
// 実行: pnpm test:user-layout(tsx + node:test のモジュールモック + react-dom/server の静的描画)
//
// 重い部品(既定の Header / Footer、BottomNav、未読モーダル)と useHeaderHeight は目印の要素にモックし、
// 枠そのもの(BackgroundLayer・#user-app-container・#stretch-wrapper・並び順・表示制御の Provider)は本物を描く。
// 期待値のうち config の値に依る部分(背景の 3 値・ボトムナビの高さと表示するデバイス)はその場の config から組み立てるので、
// config の値を変えた fork でも通る。upstream の部品そのものの固定の HTML(既定の背景)は Tier1 でだけ見る。
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement, type ReactNode } from "react";

const marker = (name: string) => {
  const Marker = () => createElement(`x-${name}`);
  Marker.displayName = `Marker(${name})`;
  return Marker;
};
const here = (path: string) => pathToFileURL(join(__dirname, path)).href;

mock.module("@/hooks/useHeaderHeight", { namedExports: { useHeaderHeight: () => 0 } });
mock.module("@/features/notification/components/common/UnreadNotificationModal", { defaultExport: marker("modal") });
mock.module(here("./BottomNav/index.tsx"), { namedExports: { UserBottomNav: marker("bottomnav") } });
mock.module(here("./BottomNav/BottomNavSpacer.tsx"), { namedExports: { BottomNavSpacer: marker("spacer") } });
mock.module(here("./Header/index.tsx"), { namedExports: { UserNavigation: marker("header") } });
mock.module(here("./Footer/index.tsx"), { namedExports: { UserFooter: marker("footer") } });

let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let UserLayout: typeof import("./UserLayout").UserLayout;
let BackgroundLayer: typeof import("./BackgroundLayer").BackgroundLayer;
let layoutConfig: typeof import("@/config/ui/user-layout.config");
let bottomNavConfig: typeof import("@/config/ui/user-bottom-menu.config");
let frameHideTokens: typeof import("@/components/AppFrames/User/controls/frameParts").frameHideTokens;
before(async () => {
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ UserLayout } = await import("./UserLayout"));
  ({ BackgroundLayer } = await import("./BackgroundLayer"));
  layoutConfig = await import("@/config/ui/user-layout.config");
  bottomNavConfig = await import("@/config/ui/user-bottom-menu.config");
  ({ frameHideTokens } = await import("@/components/AppFrames/User/controls/frameParts"));
});

// upstream(Tier1 = src/lib/CATALOG.md の先頭節の持ち主 = 自分)だけで見る検査の判定。screens.test と同じ
const { loadCatalogOwnership } = require("../../../lib/folderCatalog/catalog.mjs") as typeof import("../../../lib/folderCatalog/catalog.mjs");
const isUpstreamRoot = loadCatalogOwnership({ repoRoot: join(__dirname, "../../../.."), folder: "src/lib" }).isRoot;
const tier1Only = { skip: isUpstreamRoot ? false : "fork(Tier1 以外)は upstream の部品を自分の物に変えうるので、固定の HTML は見ない" };

/**
 * 1 行スイッチ化の前(990ffb86)の旧 src/app/(user)/layout.tsx が描いていた物(背景 overlayColor="#000"・overlayOpacity=0、子 = CHILD)
 * を同じモックで描いた HTML。既定の DOM・id・順序の基準。
 * 背景(BEFORE_BACKGROUND)と枠(BEFORE_SWITCH)に分ける: 背景の中身は config の値と BackgroundLayer の実装で決まるので、
 * 期待値ではその場で描いた背景に差し替える(固定の背景は Tier1 の test だけが見る)
 */
const BEFORE_BACKGROUND =
  '<div style="position:fixed;top:0;left:0;width:100vw;height:100lvh;z-index:-1;pointer-events:none;overflow:hidden" aria-hidden="true">' +
  '<div style="position:absolute;inset:0;background-color:hsl(var(--background))"></div></div>';
const BEFORE_SWITCH =
  '<div data-component="Flex" class="flex gap-0 flex-col items-stretch justify-start flex-nowrap my-0 min-h-[var(--viewport-height,100dvh)] text-foreground" ' +
  'id="user-app-container" data-user-app-container="" style="--app-header-height:0px">' +
  "<x-header></x-header>" +
  '<div id="stretch-wrapper" class="flex flex-1 min-h-0 flex-col pt-[var(--app-header-height,0px)]">CHILD</div>' +
  "<x-footer></x-footer><x-spacer></x-spacer><x-bottomnav></x-bottomnav><x-modal></x-modal></div>";

/**
 * 外枠の inline style の --app-bottom-nav-height(config の BOTTOM_NAV_HEIGHT)。
 * 書くのはボトムナビがある時だけ(slot 省略 = 既定のボトムナビが有効な時 / bottomNav に要素を渡した時)
 */
const bottomNavVar = (hasBottomNav = bottomNavConfig.BOTTOM_NAV_ENABLED) =>
  hasBottomNav ? `;--app-bottom-nav-height:${bottomNavConfig.BOTTOM_NAV_HEIGHT}px` : "";
/**
 * 寸法変数の区切り(notice frame-dims)で既定の DOM に入った差分はこの 1 か所だけ:
 * 外枠の inline style に --app-bottom-nav-height(config の BOTTOM_NAV_HEIGHT。既定のボトムナビが有効な時)
 */
const withBottomNavVar = (html: string) =>
  html.replace('style="--app-header-height:0px"', `style="--app-header-height:0px${bottomNavVar()}"`);
/**
 * 枠の印の区切り(notice frame-marks)で既定の DOM に入った差分はこの 1 か所だけ:
 * 外枠に data-frame-root(配下の Hide* の印で部位を隠す CSS の起点。styles/_base/frame-controls.generated.css)
 */
const withFrameRoot = (html: string) =>
  html.replace('data-user-app-container=""', 'data-user-app-container="" data-frame-root=""');
/**
 * 寸法変数の 0 と context 離れの区切り(notice frame-marks-dims)で既定の DOM に入った差分はこの 1 か所だけ:
 * 外枠の先頭にボトムナビの基本の印(config の BOTTOM_NAV_VISIBILITY で出さない PC を隠す。高さ変数もこの印で 0)
 */
/** 基本の印(config の BOTTOM_NAV_VISIBILITY で出さないデバイス。既定 = PC)。ボトムナビが無ければ描かない(条件は高さ変数と同じ) */
const baseMark = (hasBottomNav = bottomNavConfig.BOTTOM_NAV_ENABLED) => {
  if (!hasBottomNav) return "";
  const { sp, pc } = bottomNavConfig.BOTTOM_NAV_VISIBILITY;
  const tokens = frameHideTokens("bottom-nav", { sp: !sp, pc: !pc });
  return tokens ? `<span hidden="" data-frame-hide="${tokens}"></span>` : "";
};
const withBaseMark = (html: string) =>
  html.replace(`style="--app-header-height:0px${bottomNavVar()}">`, `style="--app-header-height:0px${bottomNavVar()}">${baseMark()}`);
/** 枠の期待値(背景を除く): 1 行スイッチ化の前の枠 + 区切りごとの差分。ボトムナビの値は config から */
const frameDims = () => withBaseMark(withFrameRoot(withBottomNavVar(BEFORE_SWITCH)));

const render = (node: ReactNode) => renderToStaticMarkup(node);

/** config の背景の 3 値で描いた背景(props なしの UserLayout の背景) */
const configBackground = () =>
  render(
    <BackgroundLayer
      imageUrl={layoutConfig.BACKGROUND_IMAGE_URL || undefined}
      overlayColor={layoutConfig.BACKGROUND_OVERLAY_COLOR}
      overlayOpacity={layoutConfig.BACKGROUND_OVERLAY_OPACITY}
    />,
  );
/** props なしの UserLayout の期待値 */
const defaultLayout = () => configBackground() + frameDims();

test("props なしの UserLayout は 1 行スイッチ化の前と同じ DOM を描く(背景は config/ui/user-layout.config の値で描いた BackgroundLayer。枠の差分は外枠の --app-bottom-nav-height・data-frame-root・基本の印だけ)", () => {
  assert.notEqual(withFrameRoot(BEFORE_SWITCH), BEFORE_SWITCH);
  assert.equal(render(<UserLayout>CHILD</UserLayout>), defaultLayout());
});

test("既定の BackgroundLayer は 1 行スイッチ化の前と同じ HTML を描く(upstream の部品の固定の HTML、Tier1 のみ)", tier1Only, () => {
  assert.equal(render(<BackgroundLayer overlayColor="#000" overlayOpacity={0} />), BEFORE_BACKGROUND);
});

test("header / footer の slot 省略時は既定の Header(UserNavigation)/ Footer(UserFooter)を描く", () => {
  const html = render(<UserLayout>CHILD</UserLayout>);
  assert.ok(html.includes("<x-header></x-header>"));
  assert.ok(html.includes("<x-footer></x-footer>"));
});

test("slot に要素を渡すと既定の代わりにそれを同じ位置に描く", () => {
  const html = render(
    <UserLayout
      header={<header id="h" />}
      footer={<footer id="f" />}
      bottomNav={<nav id="b" />}
      background={<i id="bg" />}
      notificationModal={<dialog id="m" />}
    >
      CHILD
    </UserLayout>,
  );
  for (const name of ["header", "footer", "spacer", "bottomnav", "modal"]) {
    assert.equal(html.includes(`<x-${name}>`), false, `既定の ${name} が残っている`);
  }
  assert.equal(html.includes("100lvh"), false, "既定の BackgroundLayer が残っている");
  const order = ['<i id="bg">', 'id="user-app-container"', '<header id="h">', 'id="stretch-wrapper"', '<footer id="f">', '<nav id="b">', '<dialog id="m">'];
  const positions = order.map((part) => html.indexOf(part));
  assert.ok(positions.every((p) => p >= 0), `見つからない: ${order.filter((_, i) => positions[i] < 0).join(", ")}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "並び順が既定と違う");
});

test("slot に null を渡すとその部品を描かない(bottomNav はスペーサーごと、--app-bottom-nav-height も書かない)", () => {
  const html = render(
    <UserLayout banner={null} header={null} footer={null} bottomNav={null} background={null} notificationModal={null}>
      CHILD
    </UserLayout>,
  );
  assert.equal(
    html,
    '<div data-component="Flex" class="flex gap-0 flex-col items-stretch justify-start flex-nowrap my-0 min-h-[var(--viewport-height,100dvh)] text-foreground" ' +
      'id="user-app-container" data-user-app-container="" data-frame-root="" style="--app-header-height:0px">' +
      '<div id="stretch-wrapper" class="flex flex-1 min-h-0 flex-col pt-[var(--app-header-height,0px)]">CHILD</div></div>',
  );
});

test("bottomNav に要素を渡しても --app-bottom-nav-height は config の BOTTOM_NAV_HEIGHT で、基本の印も描く(差し替えも BOTTOM_NAV_VISIBILITY に従う)", () => {
  const html = render(<UserLayout bottomNav={<nav id="b" />}>CHILD</UserLayout>);
  assert.ok(html.includes(`style="--app-header-height:0px${bottomNavVar(true)}">${baseMark(true)}`));
});

test("bottomNav={null} では基本の印を描かない(高さ変数も書かないので隠す物が無い)", () => {
  assert.equal(render(<UserLayout bottomNav={null}>CHILD</UserLayout>).includes("data-frame-hide"), false);
});

test("banner の省略と null は同じ(既定なし): 帯・スペーサー・--app-banner-height を描かない", () => {
  assert.equal(render(<UserLayout banner={null}>CHILD</UserLayout>), defaultLayout());
  assert.equal(render(<UserLayout>CHILD</UserLayout>).includes("app-banner"), false);
});

test("banner に要素を渡すとヘッダーより前の固定の帯に描き、本文の前にその高さのスペーサーを置く", () => {
  const html = render(<UserLayout banner={<p id="promo">PROMO</p>}>CHILD</UserLayout>);
  // 静的描画では実測前なので 0px(ブラウザでは ResizeObserver の実測値)
  assert.ok(
    html.includes(`style="--app-header-height:0px${bottomNavVar()};--app-banner-height:0px"`),
    "外枠に --app-banner-height が無い",
  );
  const banner = '<div id="app-banner" class="fixed inset-x-0 top-0 header-layer"><p id="promo">PROMO</p></div>';
  const spacer = '<div aria-hidden="true" class="shrink-0 h-[var(--app-banner-height,0px)]"></div>';
  const order = ['id="user-app-container"', banner, "<x-header></x-header>", spacer, 'id="stretch-wrapper"'];
  const positions = order.map((part) => html.indexOf(part));
  assert.ok(positions.every((p) => p >= 0), `見つからない: ${order.filter((_, i) => positions[i] < 0).join(", ")}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "並び順が違う");
  // banner なしの HTML に帯とスペーサーと変数を足しただけ(他は変わらない)
  assert.equal(
    html.replace(banner, "").replace(spacer, "").replace(";--app-banner-height:0px", ""),
    defaultLayout(),
  );
});
