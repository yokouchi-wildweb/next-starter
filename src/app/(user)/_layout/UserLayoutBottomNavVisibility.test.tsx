// ボトムナビの基本の表示(config/ui/user-bottom-menu.config の BOTTOM_NAV_VISIBILITY)を UserLayout が「隠す印」で描くことの検査
// (config をモックするため UserLayout.test.tsx と別ファイル。実行: pnpm test:user-layout)
// 印の規則(display: none と --app-bottom-nav-height の 0)は styles/frame-controls.generated.css。ここは描く印だけを見る。
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

// 描画のたびに値を差し替える(UserLayout は描画時に読む)
const visibility = { sp: true, pc: false };
mock.module("@/config/ui/user-bottom-menu.config", {
  namedExports: { BOTTOM_NAV_ENABLED: true, BOTTOM_NAV_HEIGHT: 64, BOTTOM_NAV_VISIBILITY: visibility },
});
mock.module("@/hooks/useHeaderHeight", { namedExports: { useHeaderHeight: () => 0 } });
mock.module("@/features/notification/components/common/UnreadNotificationModal", { defaultExport: marker("modal") });
mock.module(here("./BottomNav/index.tsx"), { namedExports: { UserBottomNav: marker("bottomnav") } });
mock.module(here("./BottomNav/BottomNavSpacer.tsx"), { namedExports: { BottomNavSpacer: marker("spacer") } });
mock.module("@/config/ui/user-header.config", { namedExports: { UserNavigation: marker("header") } });
mock.module("@/config/ui/user-footer.config", { namedExports: { UserFooter: marker("footer") } });

let render: (node: ReactNode) => string;
let UserLayout: typeof import("./UserLayout").UserLayout;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ UserLayout } = await import("./UserLayout"));
});

const marksOf = (html: string) => [...html.matchAll(/data-frame-hide="([^"]*)"/g)].map((m) => m[1]);

const withVisibility = (next: { sp: boolean; pc: boolean }, fn: () => void) => {
  const saved = { ...visibility };
  Object.assign(visibility, next);
  try {
    fn();
  } finally {
    Object.assign(visibility, saved);
  }
};

test("出さないデバイスだけを隠す印にする(既定 = PC を隠す)", () => {
  assert.deepEqual(marksOf(render(<UserLayout>CHILD</UserLayout>)), ["bottom-nav-pc"]);
  withVisibility({ sp: true, pc: true }, () => {
    assert.deepEqual(marksOf(render(<UserLayout>CHILD</UserLayout>)), [], "PC にも出すなら印は無い");
  });
  withVisibility({ sp: false, pc: true }, () => {
    assert.deepEqual(marksOf(render(<UserLayout>CHILD</UserLayout>)), ["bottom-nav-sp"]);
  });
  withVisibility({ sp: false, pc: false }, () => {
    assert.deepEqual(marksOf(render(<UserLayout>CHILD</UserLayout>)), ["bottom-nav-sp bottom-nav-pc"]);
  });
});

test("差し替えたボトムナビにも同じ印が効き、bottomNav={null} では描かない", () => {
  assert.deepEqual(marksOf(render(<UserLayout bottomNav={<nav id="b" />}>CHILD</UserLayout>)), ["bottom-nav-pc"]);
  assert.deepEqual(marksOf(render(<UserLayout bottomNav={null}>CHILD</UserLayout>)), []);
});
