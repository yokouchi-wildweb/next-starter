// 操作部品の高さの段(--control-h-* / --tablet-control-h-*)とボタンの size の対応の検査。
// - Button の 9 size・TabletButton の 6 size の高さは段のトークンから取る(数値の h-* を持たない)
// - icon・icon-lg・none は段の外のまま
// - variants.config の上書き(size の className)と要素の className の高さがトークンの高さに勝つ
// 実行: pnpm test src/components/Button/variants/controlHeight.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { cn } from "@/lib/cn";
import { createOverridableVariants } from "@/lib/variantOverrides";

import { buttonVariants } from "./button-variants";
import { tabletButtonVariants } from "./tablet-button-variants";

const BUTTON_SIZES = ["xxxs", "xxs", "xs", "sm", "md", "lg", "xl", "xxl", "xxxl"] as const;
const TABLET_SIZES = ["xxs", "xs", "sm", "md", "lg", "xl"] as const;
const heights = (classes: string) => classes.split(/\s+/).filter((c) => /^h-/.test(c) || /^size-/.test(c));

test("Button の 9 size は高さを --control-h-<名前> から取る(数値の h-* を持たない)", () => {
  for (const size of BUTTON_SIZES) {
    assert.deepEqual(heights(buttonVariants({ size })), [`h-(--control-h-${size})`], size);
  }
  assert.deepEqual(heights(buttonVariants({})), ["h-(--control-h-md)"], "既定は md");
  assert.deepEqual(heights(buttonVariants({ size: "icon" })), ["size-9"]);
  assert.deepEqual(heights(buttonVariants({ size: "none" })), []);
});

test("TabletButton の 6 size は高さを --tablet-control-h-<名前> から取る", () => {
  for (const size of TABLET_SIZES) {
    assert.deepEqual(heights(tabletButtonVariants({ size })), [`h-(--tablet-control-h-${size})`], size);
  }
  assert.deepEqual(heights(tabletButtonVariants({ size: "icon" })), ["size-16"]);
  assert.deepEqual(heights(tabletButtonVariants({ size: "icon-lg" })), ["size-20"]);
});

test("要素の className の高さはトークンの高さに勝つ", () => {
  assert.deepEqual(heights(buttonVariants({ size: "sm", className: "h-auto py-3" })), ["h-auto"]);
  assert.deepEqual(heights(buttonVariants({ size: "md", className: "h-12" })), ["h-12"]);
  assert.deepEqual(heights(cn(tabletButtonVariants({ size: "md" }), "h-[clamp(3rem,8vh,5rem)]")), ["h-[clamp(3rem,8vh,5rem)]"]);
});

test("variants.config の size の上書きはトークンの高さに勝つ(上書き → 要素の className の順)", () => {
  const variants = createOverridableVariants(
    "",
    { variants: { size: { md: "h-(--control-h-md) px-4", sm: "h-(--control-h-sm) px-3" } }, defaultVariants: { size: "md" } },
    { size: { md: "h-12" } },
  );
  assert.deepEqual(heights(variants({})), ["h-12"]);
  assert.deepEqual(heights(variants({ size: "sm" })), ["h-(--control-h-sm)"]);
  assert.deepEqual(heights(variants({ className: "h-auto" })), ["h-auto"]);
});
