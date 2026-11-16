// Layout 部品の余白 prop の検査(余白の段、spacing.ts)。
// - 全部品の余白 prop が段の名前 / 幅別オブジェクトを受け、同じ名前は部品が違っても同じ class(生成した表)になる
// - 既定値: Main padding = { base: "sm", sm: "md" }(12 → 16px)、Flex・Grid・Stack の gap = none(0)
// - className が prop の class より勝つ(cn。幅別の class も同じ幅のものだけ外れる)
// 実行: pnpm test src/components/Layout/spacing.test.tsx
// (package.json に type: module が無いので tsx は CJS = top-level await 不可 → before() で import)
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";

let render: (node: ReactElement) => string;
let L: typeof import("./index");
let spacing: typeof import("./spacing");
let SPACING_CLASSES: typeof import("./spacingClasses.generated").SPACING_CLASSES;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  L = await import("./index");
  spacing = await import("./spacing");
  ({ SPACING_CLASSES } = await import("./spacingClasses.generated"));
});

/** 描いた一番外の要素(at = その字面を持つ要素から。Main は余白を付ける要素)の class の集まり */
const classesOf = (html: string, at_ = "") => {
  const at = at_ ? html.indexOf(at_) : 0;
  assert.ok(at >= 0, `${at_} が無い`);
  const m = /class="([^"]*)"/.exec(html.slice(at));
  return new Set((m?.[1] ?? "").split(/\s+/).filter(Boolean));
};
/** Main を子 "x" つきで描く(Main は children が必須) */
const renderMain = (props: Omit<import("./Main").MainProps, "children">) => render(<L.Main {...props}>x</L.Main>);
const has = (set: Set<string>, ...classes: string[]) => {
  for (const c of classes) assert.ok(set.has(c), `${c} が無い: ${[...set].join(" ")}`);
};

test("spacingClassName: 名前は base の class、幅別は base → 2xl の順、未指定は空", () => {
  assert.equal(spacing.spacingClassName("gap", "md"), "gap-(--space-md)");
  assert.equal(spacing.spacingClassName("padding", { lg: "xl", base: "sm", sm: "md" }), "p-(--space-sm) sm:p-(--space-md) lg:p-(--space-xl)");
  assert.equal(spacing.spacingClassName("gapX", undefined), "");
  assert.equal(spacing.spacingClassName("gapY", null), "");
  assert.equal(spacing.spacingClassName("marginInline", {}), "");
});

test("全部品: 同じ名前の余白 prop は同じ class(部品で大きさが変わらない)", () => {
  const box = { padding: "md", paddingBlock: "lg", paddingInline: "xs", margin: "2xs", marginBlock: "xl", marginInline: "4xl" } as const;
  const expected = [
    SPACING_CLASSES.padding.base.md,
    SPACING_CLASSES.paddingBlock.base.lg,
    SPACING_CLASSES.paddingInline.base.xs,
    SPACING_CLASSES.margin.base["2xs"],
    SPACING_CLASSES.marginBlock.base.xl,
    SPACING_CLASSES.marginInline.base["4xl"],
  ];
  const rendered: Array<[string, string, string?]> = [
    ["Block", render(createElement(L.Block, box))],
    ["InBlock", render(createElement(L.InBlock, box))],
    ["Section", render(createElement(L.Section, { ...box, as: "article" }))],
    ["Flex", render(createElement(L.Flex, box))],
    ["Grid", render(createElement(L.Grid, box))],
    ["Stack", render(createElement(L.Stack, box))],
    ["Main plain", renderMain({ ...box, containerType: "plain" }), 'data-slot="main"'],
    ["Main contentShell", renderMain({ ...box, containerType: "contentShell" }), 'data-slot="main"'],
    ["Main surfaceDisplay", renderMain({ ...box, containerType: "surfaceDisplay" }), 'data-slot="main-layout"'],
  ];
  for (const [name, html, tag] of rendered) {
    const set = classesOf(html, tag);
    has(set, ...expected);
    assert.ok(![...set].some((c) => /^(p|px|py|m|mx|my)-\d/.test(c)), `${name} に旧い数値の class`);
  }
});

test("gap・gapX・gapY: Flex・Grid・Stack で同じ名前 = 同じ class、幅別も", () => {
  const gap = { base: "xs", md: "lg" } as const;
  for (const part of [L.Flex, L.Grid, L.Stack]) {
    has(classesOf(render(createElement(part, { gap }))), "gap-(--space-xs)", "md:gap-(--space-lg)");
  }
  has(classesOf(render(createElement(L.Grid, { gapX: "md", gapY: { base: "sm", "2xl": "3xl" } }))),
    "gap-(--space-none)", "gap-x-(--space-md)", "gap-y-(--space-sm)", "2xl:gap-y-(--space-3xl)");
});

test("既定値: Main padding は {base: sm, sm: md}(12 → 16px)、Flex・Grid・Stack の gap は none", () => {
  for (const containerType of ["plain", "narrowStack", "surfaceDisplay", "fullscreen"] as const) {
    const slot = containerType === "surfaceDisplay" ? 'data-slot="main-layout"' : 'data-slot="main"';
    const set = classesOf(renderMain({ containerType }), slot);
    has(set, "p-(--space-sm)", "sm:p-(--space-md)");
  }
  assert.deepEqual(spacing.spacingClassName("padding", { base: "sm", sm: "md" }), "p-(--space-sm) sm:p-(--space-md)");
  for (const part of [L.Flex, L.Grid, L.Stack]) has(classesOf(render(createElement(part, {}))), "gap-(--space-none)");
  const block = classesOf(render(createElement(L.Block, {})));
  assert.ok(![...block].some((c) => c.includes("--space-")), "Block は既定で余白を付けない");
});

test("className が prop の class より勝つ(同じ幅のものだけ外れる)", () => {
  const flex = classesOf(render(createElement(L.Flex, { gap: { base: "md", sm: "lg" }, className: "gap-4" })));
  assert.ok(!flex.has("gap-(--space-md)"));
  has(flex, "gap-4", "sm:gap-(--space-lg)");
  const stack = classesOf(render(createElement(L.Stack, { padding: "md", className: "p-2 sm:p-6" })));
  assert.ok(!stack.has("p-(--space-md)"));
  has(stack, "p-2", "sm:p-6");
  const main = classesOf(renderMain({ containerType: "plain", className: "p-0" }), 'data-slot="main"');
  assert.ok(!main.has("p-(--space-sm)"));
  has(main, "p-0", "sm:p-(--space-md)");
});
