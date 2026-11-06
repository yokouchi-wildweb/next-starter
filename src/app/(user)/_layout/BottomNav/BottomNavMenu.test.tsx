// BottomNavMenu の開く向き(side)が ActionPopover に渡ることの検査(ActionPopover をモックするため UserParts.test.tsx と別ファイル)。
// 省略時の DOM が今と同じことは UserParts.test.tsx。実行: pnpm test src/app/(user)/_layout/BottomNav/BottomNavMenu.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";

mock.module("next/navigation", { namedExports: { useRouter: () => ({ push: () => {} }) } });
mock.module("@/components/Overlays/Popover", {
  namedExports: {
    ActionPopover: ({ side, align, title }: { side: string; align: string; title: string }) => createElement("x-popover", { "data-side": side, "data-align": align, title }),
  },
});

let render: (node: ReactNode) => string;
let BottomNavMenu: typeof import("./BottomNavMenu").BottomNavMenu;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ BottomNavMenu } = await import("./BottomNavMenu"));
});

const Icon = () => createElement("x-icon");
const item = { type: "menu" as const, key: "create", label: "作成", icon: Icon, menu: [{ key: "post", label: "投稿", href: "/items" }] };

test("side の省略は上向き(top)、\"bottom\" を渡すと下向きで開く(align は center のまま)", () => {
  assert.equal(render(<BottomNavMenu item={item} trigger={null} />), '<x-popover data-side="top" data-align="center" title="作成"></x-popover>');
  assert.equal(render(<BottomNavMenu item={item} trigger={null} side="bottom" />), '<x-popover data-side="bottom" data-align="center" title="作成"></x-popover>');
});
