// UserLayout(ユーザー側の枠の既定の組み立て)の slot と、props なしの描画が 1 行スイッチ化の前と同じことの検査。
// 実行: pnpm test:user-layout(tsx + node:test のモジュールモック + react-dom/server の静的描画)
//
// 重い部品(config の UserNavigation / UserFooter、BottomNav、未読モーダル)と useHeaderHeight は目印の要素にモックし、
// 枠そのもの(BackgroundLayer・#user-app-container・#stretch-wrapper・並び順・表示制御の Provider)は本物を描く。
// config の UserNavigation / UserFooter のモック = 「config を HeaderCustom / FooterCustom に切り替えた fork」の状態でもある。
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
mock.module("@/config/ui/user-header.config", { namedExports: { UserNavigation: marker("header") } });
mock.module("@/config/ui/user-footer.config", { namedExports: { UserFooter: marker("footer") } });

let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let UserLayout: typeof import("./UserLayout").UserLayout;
let UserAppLayout: typeof import("./UserLayout").UserAppLayout;
before(async () => {
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ UserLayout, UserAppLayout } = await import("./UserLayout"));
});

/**
 * 1 行スイッチ化の前(990ffb86)の `<UserAppLayout overlayColor="#000" overlayOpacity={0}>CHILD</UserAppLayout>`
 * (= 旧 src/app/(user)/layout.tsx が描いていた物)を同じモックで描いた HTML。既定の DOM・id・順序の基準
 */
const BEFORE_SWITCH =
  '<div style="position:fixed;top:0;left:0;width:100vw;height:100lvh;z-index:-1;pointer-events:none;overflow:hidden" aria-hidden="true">' +
  '<div style="position:absolute;inset:0;background-color:hsl(var(--background))"></div></div>' +
  '<div data-component="Flex" class="flex gap-0 flex-col items-stretch justify-start flex-nowrap my-0 min-h-[var(--viewport-height,100dvh)] text-foreground" ' +
  'id="user-app-container" data-user-app-container="" style="--app-header-height:0px">' +
  "<x-header></x-header>" +
  '<div id="stretch-wrapper" class="flex flex-1 min-h-0 flex-col pt-[var(--app-header-height,0px)]">CHILD</div>' +
  "<x-footer></x-footer><x-spacer></x-spacer><x-bottomnav></x-bottomnav><x-modal></x-modal></div>";

const render = (node: ReactNode) => renderToStaticMarkup(node);

test("props なしの UserLayout は 1 行スイッチ化の前と同じ DOM を描く(背景は config/ui/user-layout.config の既定値)", () => {
  assert.equal(render(<UserLayout>CHILD</UserLayout>), BEFORE_SWITCH);
});

test("互換の UserAppLayout は旧 props のまま同じ DOM を描き、backgroundImageUrl を背景に写す", () => {
  assert.equal(render(<UserAppLayout overlayColor="#000" overlayOpacity={0}>CHILD</UserAppLayout>), BEFORE_SWITCH);
  const withImage = render(
    <UserAppLayout backgroundImageUrl="/bg.jpg" overlayColor="red" overlayOpacity={0.5}>
      CHILD
    </UserAppLayout>,
  );
  assert.match(withImage, /<img src="\/bg\.jpg"/);
  assert.match(withImage, /background-color:red;opacity:0\.5/);
});

test("header / footer の slot 省略時は config の UserNavigation / UserFooter(旧切替の経路)を描く", () => {
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

test("slot に null を渡すとその部品を描かない(bottomNav はスペーサーごと)", () => {
  const html = render(
    <UserLayout header={null} footer={null} bottomNav={null} background={null} notificationModal={null}>
      CHILD
    </UserLayout>,
  );
  assert.equal(
    html,
    '<div data-component="Flex" class="flex gap-0 flex-col items-stretch justify-start flex-nowrap my-0 min-h-[var(--viewport-height,100dvh)] text-foreground" ' +
      'id="user-app-container" data-user-app-container="" style="--app-header-height:0px">' +
      '<div id="stretch-wrapper" class="flex flex-1 min-h-0 flex-col pt-[var(--app-header-height,0px)]">CHILD</div></div>',
  );
});
