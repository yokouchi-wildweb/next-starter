// 入力欄系の高さの検査(操作部品の高さの段 --control-h-*、余白の議会 D46 K1・K4)。
// - Input と上の部品は size xs〜xl(既定 md)を受け、高さは h-(--control-h-<size>) py-0 だけ(旧 h-auto py-3 は無い)
// - 同じ size のボタンと同じトークン
// - 上書きの口 input(variants.config)と要素の className の高さがトークンに勝つ
// - HTML の size 属性は htmlSize で渡し、DOM の <input size> に届く
// 実行: pnpm test src/components/Form/Input/Manual/inputHeight.test.tsx
// (tsx。type: module が無いので tsx は CJS = top-level await 不可 → before() で import。config は mock.module で差し替え)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";

import { defineVariantOverrides, type VariantOverrides } from "@/lib/variantOverrides";

const OV: VariantOverrides = defineVariantOverrides({});
mock.module("@/lib/variantOverrides/config", { namedExports: { variantOverrides: OV } });

let render: typeof import("react-dom/server").renderToStaticMarkup;
let Input: typeof import("./Input").Input;
let PasswordInput: typeof import("./PasswordInput").PasswordInput;
let ColorInput: typeof import("./ColorInput").ColorInput;
let buttonVariants: typeof import("@/components/Form/Button/button-variants").buttonVariants;
let PrimitiveInput: typeof import("@/components/Primitives/Input").Input;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ Input } = await import("./Input"));
  ({ PasswordInput } = await import("./PasswordInput"));
  ({ ColorInput } = await import("./ColorInput"));
  ({ buttonVariants } = await import("@/components/Form/Button/button-variants"));
  ({ Input: PrimitiveInput } = await import("@/components/Primitives/Input"));
});

const inputTag = (html: string) => /<input[^>]*>/.exec(html)?.[0] ?? "";
const classesOf = (tag: string) => (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean);
const heights = (classes: string[]) => classes.filter((c) => /^(h|py|size)-/.test(c));
const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

test("Input は size xs〜xl の高さを --control-h-<size> から取り、py-0。既定は md、旧 h-auto py-3 は無い", () => {
  for (const size of SIZES) {
    assert.deepEqual(heights(classesOf(inputTag(render(h(Input, { size, readOnly: true }))))), [`h-(--control-h-${size})`, "py-0"], size);
  }
  const plain = classesOf(inputTag(render(h(Input, {}))));
  assert.deepEqual(heights(plain), ["h-(--control-h-md)", "py-0"]);
  assert.ok(!plain.includes("h-auto") && !plain.includes("py-3"));
  assert.ok(plain.includes("md:text-sm"), "文字の大きさは不変");
  // アイコン・クリアのある形(ラッパーで囲む)も同じ
  const icon = classesOf(inputTag(render(h(Input, { leftIcon: h("i"), size: "lg" }))));
  assert.deepEqual(heights(icon), ["h-(--control-h-lg)", "py-0"]);
  assert.ok(icon.includes("pl-10"));
});

test("同じ size のボタンと入力欄は同じトークン", () => {
  for (const size of SIZES) {
    const button = buttonVariants({ size }).split(/\s+/).find((c) => c.startsWith("h-"));
    assert.equal(button, `h-(--control-h-${size})`);
    assert.ok(classesOf(inputTag(render(h(Input, { size })))).includes(button!), size);
  }
});

test("上の部品(PasswordInput・ColorInput の hex 欄と見本)も size を受ける", () => {
  assert.deepEqual(heights(classesOf(inputTag(render(h(PasswordInput, { size: "sm", value: "", onChange: () => {}, autoComplete: "current-password" }))))), ["h-(--control-h-sm)", "py-0"]);
  const color = render(h(ColorInput, { size: "lg", value: "#112233" }));
  const tags = [...color.matchAll(/<input[^>]*>/g)].map((m) => m[0]);
  assert.ok(classesOf(tags[0]).includes("size-(--control-h-lg)"), "色の見本");
  assert.deepEqual(heights(classesOf(tags[1])), ["h-(--control-h-lg)", "py-0"], "hex 欄");
  // Primitives の素の Input は sm(今の h-9 = 36px と同じ)
  assert.ok(classesOf(inputTag(render(h(PrimitiveInput, {})))).includes("h-(--control-h-sm)"));
});

test("上書きの口 input と要素の className の高さがトークンに勝つ", () => {
  try {
    Object.assign(OV.input, { base: "rounded-none", size: { md: "h-12" } });
    const md = classesOf(inputTag(render(h(Input, {}))));
    assert.ok(md.includes("h-12") && !md.includes("h-(--control-h-md)"));
    assert.ok(md.includes("rounded-none"));
    const sm = classesOf(inputTag(render(h(Input, { size: "sm" }))));
    assert.ok(sm.includes("h-(--control-h-sm)"));
    const own = classesOf(inputTag(render(h(Input, { className: "h-auto py-2" }))));
    assert.deepEqual(heights(own), ["h-auto", "py-2"]);
  } finally {
    for (const key of Object.keys(OV.input)) delete (OV.input as Record<string, unknown>)[key];
  }
});

test("HTML の size 属性は htmlSize で渡し、DOM に届く", () => {
  assert.match(inputTag(render(h(Input, { htmlSize: 12 }))), / size="12"/);
  assert.doesNotMatch(inputTag(render(h(Input, { size: "lg" }))), / size="/);
});
