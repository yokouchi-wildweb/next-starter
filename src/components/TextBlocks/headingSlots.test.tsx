// 見出しの印(data-slot)の検査: 部位の一覧(src/app/_layout/frame/parts.mjs)の見出し 5 つ = 見出しの部品が描く data-slot。
// - 5 部品(UserPageTitle・PageTitle・AdminPageTitleBody / Heading・SecTitle・管理の SecTitle)を srOnly あり・なしで描く
// - srOnly でも h1 / 見出しの印は残る。user-page-title は srOnly の時は描かない(外側の header が無い)
// - 呼び手が props で渡した data-slot は部品の印に負ける。ヘッダーの圧縮の題(AdminPageTitleCompact)は印を持たない
// 実行: pnpm test src/components/TextBlocks/headingSlots.test.tsx
// (package.json に type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type FC, type ReactElement } from "react";

let render: (node: ReactElement) => string;
let PageTitle: typeof import("./PageTitle").PageTitle;
let SecTitle: typeof import("./SecTitle").SecTitle;
let UserPageTitle: typeof import("@/app/(user)/_layout/PageTitle").UserPageTitle;
let AdminTitle: typeof import("@/app/admin/_layout/AdminPageTitle");
let AdminSecTitle: typeof import("@/components/AppFrames/Admin/Elements/SecTitle").default;
let headingSlots: string[];
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ PageTitle } = await import("./PageTitle"));
  ({ SecTitle } = await import("./SecTitle"));
  ({ UserPageTitle } = await import("@/app/(user)/_layout/PageTitle"));
  AdminTitle = await import("@/app/admin/_layout/AdminPageTitle");
  AdminSecTitle = (await import("@/components/AppFrames/Admin/Elements/SecTitle")).default;
  const { FRAME_SLOTS } = await import("@/app/_layout/frame");
  headingSlots = FRAME_SLOTS.filter((s) => s.area === "heading").map((s) => s.name);
});

const slotsOf = (html: string) => [...html.matchAll(/data-slot="([a-z-]+)"/g)].map((m) => m[1]);
/** 呼び手が渡そうとする data-slot(部品の印に負けることを見る) */
const callerSlot = { "data-slot": "caller" } as Record<string, string>;

test("描いた見出しの印の集まり = 部位の一覧の見出し 5 つ", () => {
  const html = [
    render(createElement(UserPageTitle, null, "題")),
    render(createElement(PageTitle, null, "題")),
    render(createElement(AdminTitle.AdminPageTitleBody, null, "題")),
    render(createElement(SecTitle, null, "節")),
    render(createElement(AdminSecTitle, null, "節")),
  ].join("");
  assert.deepEqual([...new Set(slotsOf(html))].sort(), [...headingSlots].sort());
});

test("UserPageTitle: 外側の header に user-page-title、中の h1 に page-title。srOnly では外側が無く page-title だけ", () => {
  const html = render(createElement(UserPageTitle, null, "題"));
  assert.match(html, /^<header[^>]*data-slot="user-page-title"/);
  assert.equal(html.includes('id="page-title"'), false, "見た目のための id は外した(指令 08。狙う先は data-slot)");
  assert.deepEqual(slotsOf(html), ["user-page-title", "page-title"]);
  const sr = render(createElement(UserPageTitle, { srOnly: true }, "題"));
  assert.deepEqual(slotsOf(sr), ["page-title"]);
  assert.match(sr, /^<h1[^>]*class="[^"]*sr-only/);
});

test("PageTitle・SecTitle: srOnly でも印が残り、呼び手の data-slot は負ける", () => {
  for (const srOnly of [false, true]) {
    assert.deepEqual(slotsOf(render(createElement(PageTitle, { srOnly, ...callerSlot }, "題"))), ["page-title"]);
    assert.deepEqual(slotsOf(render(createElement(SecTitle as FC<Partial<Parameters<typeof SecTitle>[0]>>, { srOnly, ...callerSlot }, "節"))), ["sec-title"]);
  }
  assert.match(render(createElement(SecTitle as FC<Partial<Parameters<typeof SecTitle>[0]>>, { as: "h3" }, "節")), /^<h3[^>]*data-slot="sec-title"/);
});

test("管理の見出し: 本文の h1(Body・Heading)は admin-page-title、圧縮の題は印なし、管理の SecTitle は admin-sec-title", () => {
  assert.deepEqual(slotsOf(render(createElement(AdminTitle.AdminPageTitleBody, null, "題"))), ["admin-page-title"]);
  assert.match(render(createElement(AdminTitle.AdminPageTitleBody, null, "題")), /^<h1[^>]*sm:sr-only/);
  assert.deepEqual(slotsOf(render(createElement(AdminTitle.AdminPageTitleHeading, { ...callerSlot }, "題"))), ["admin-page-title"]);
  assert.deepEqual(slotsOf(render(createElement(AdminTitle.AdminPageTitleCompact, null, "題"))), []);
  for (const srOnly of [false, true]) {
    assert.deepEqual(slotsOf(render(createElement(AdminSecTitle as FC<Partial<Parameters<typeof AdminSecTitle>[0]>>, { srOnly, ...callerSlot }, "節"))), ["admin-sec-title"]);
  }
});
