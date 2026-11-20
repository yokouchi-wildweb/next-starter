// 余白 prop の値 → class の引き当ての検査(spacing.ts)。部品が出す class の検査は src/components/Layout/layoutSpacing.test.tsx
// 実行: pnpm test src/lib/spacing
import { test } from "node:test";
import assert from "node:assert/strict";

import { boxSpacingClassName, spacingClassName } from "./spacing";

test("spacingClassName: 名前は base の class、幅別は base → 2xl の順、未指定は空", () => {
  assert.equal(spacingClassName("gap", "md"), "gap-(--space-md)");
  assert.equal(spacingClassName("padding", { lg: "xl", base: "sm", sm: "md" }), "p-(--space-sm) sm:p-(--space-md) lg:p-(--space-xl)");
  assert.equal(spacingClassName("padding", { base: "sm", sm: "md" }), "p-(--space-sm) sm:p-(--space-md)");
  assert.equal(spacingClassName("gapX", undefined), "");
  assert.equal(spacingClassName("gapY", null), "");
  assert.equal(spacingClassName("marginInline", {}), "");
});

test("boxSpacingClassName: padding → paddingBlock → paddingInline → margin → marginBlock → marginInline の順、未指定は飛ばす", () => {
  assert.equal(
    boxSpacingClassName({ marginInline: "4xl", padding: "md", paddingBlock: null }),
    "p-(--space-md) mx-(--space-4xl)",
  );
  assert.equal(boxSpacingClassName({}), "");
});
