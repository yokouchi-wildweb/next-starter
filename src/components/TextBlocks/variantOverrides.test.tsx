// TextBlocks 4 つ(PageTitle / Para / SecTitle / Span)の見た目の上書き口(src/config/ui/variants.config.ts の
// pageTitle / para / secTitle / span、@/lib/variantOverrides)の検査。
// 実行: pnpm test src/components/TextBlocks/variantOverrides.test.tsx
// (tsx。before() で import。config は mock.module で差し替え)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";

import { defineVariantOverrides, type VariantOverrides } from "@/lib/variantOverrides";

// 上書きの値はテストごとに中身だけ入れ替える(部品は読み込み時にキーのオブジェクトを掴むので、入れ物は同じまま)
const OV: VariantOverrides = defineVariantOverrides({});
mock.module("@/config/ui/variants.config", { namedExports: { VARIANT_OVERRIDES: OV } });

/** 入れ子のキー(中のオブジェクトを部品が掴む) */
const NESTED = new Set(["badge", "switchInput"]);
const clear = (o: object) => {
  for (const k of Object.keys(o)) delete (o as Record<string, unknown>)[k];
};
function reset() {
  for (const [key, value] of Object.entries(OV)) {
    if (NESTED.has(key)) for (const inner of Object.values(value)) clear(inner as object);
    else clear(value);
  }
}

let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
let PageTitle: typeof import("./PageTitle").PageTitle;
let Para: typeof import("./Para").Para;
let SecTitle: typeof import("./SecTitle").SecTitle;
let Span: typeof import("./Span").Span;
before(async () => {
  ({ renderToStaticMarkup } = await import("react-dom/server"));
  ({ PageTitle } = await import("./PageTitle"));
  ({ Para } = await import("./Para"));
  ({ SecTitle } = await import("./SecTitle"));
  ({ Span } = await import("./Span"));
});

/** 上書きの無い今の描画(変更の前に描いた文字列)。上書きが空なら 1 字も変わらない */
const BEFORE: Record<string, string> = {
  "pageTitle:default": "<h1 class=\"tracking-tight text-inherit text-2xl font-bold text-left\" data-slot=\"page-title\">x</h1>",
  "pageTitle:all": "<h1 class=\"tracking-tight text-muted-foreground text-lg font-medium text-center\" data-slot=\"page-title\">x</h1>",
  "pageTitle:inherit": "<h1 class=\"tracking-tight text-inherit extra\" data-slot=\"page-title\">x</h1>",
  "para:default": "<p class=\"my-2 text-inherit text-base font-normal text-left\">x</p>",
  "para:all": "<p class=\"my-2 text-muted-foreground text-lg font-medium text-center\">x</p>",
  "para:inherit": "<p class=\"my-2 text-inherit leading-[inherit] extra\">x</p>",
  "secTitle:default": "<h2 class=\"text-inherit text-xl font-bold text-left\" data-slot=\"sec-title\">x</h2>",
  "secTitle:all": "<h2 class=\"text-muted-foreground text-lg font-medium text-center\" data-slot=\"sec-title\">x</h2>",
  "secTitle:inherit": "<h2 class=\"text-inherit extra\" data-slot=\"sec-title\">x</h2>",
  "span:default": "<span class=\"inline-block text-inherit text-base font-normal\">x</span>",
  "span:all": "<span class=\"inline-block text-muted-foreground text-lg font-medium text-center\">x</span>",
  "span:inherit": "<span class=\"inline-block text-inherit leading-[inherit] extra\">x</span>"
};

const parts = () =>
  [
    ["pageTitle", PageTitle],
    ["para", Para],
    ["secTitle", SecTitle],
    ["span", Span],
  ] as const;

function renderAll(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, C] of parts()) {
    const P = C as unknown as (props: Record<string, unknown>) => ReturnType<typeof h>;
    out[`${k}:default`] = renderToStaticMarkup(h(P, null, "x"));
    out[`${k}:all`] = renderToStaticMarkup(h(P, { tone: "muted", size: "lg", weight: "medium", align: "center" }, "x"));
    out[`${k}:inherit`] = renderToStaticMarkup(
      h(P, { tone: "inherit", size: "inherit", weight: "inherit", align: "inherit", className: "extra" }, "x"),
    );
  }
  return out;
}

test("上書きが空なら TextBlocks 4 つの描画は前と同じ", () => {
  reset();
  assert.deepEqual(renderAll(), BEFORE);
});

for (const key of ["pageTitle", "para", "secTitle", "span"] as const) {
  test(`${key}: base・tone・size・weight・align の上書きが付き、呼び手の className が最後に勝つ`, () => {
    reset();
    Object.assign(OV[key], {
      base: "ov-base",
      tone: { muted: "ov-tone" },
      size: { lg: "ov-size" },
      weight: { medium: "ov-weight" },
      align: { center: "ov-align" },
    });
    const C = parts().find(([k]) => k === key)![1] as unknown as (props: Record<string, unknown>) => ReturnType<typeof h>;
    const html = renderToStaticMarkup(
      h(C, { tone: "muted", size: "lg", weight: "medium", align: "center", className: "text-xs" }, "x"),
    );
    assert.match(html, /class="[^"]*ov-base ov-tone ov-size ov-weight ov-align[^"]*text-xs"/);
    // 当たらない値の上書きは付かない
    const other = renderToStaticMarkup(h(C, { tone: "primary" }, "x"));
    assert.doesNotMatch(other, /ov-tone/);
    assert.match(other, /ov-base/);
  });
}
