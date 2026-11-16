// 余白の段の名前の一覧と、生成した class の表(src/components/Layout/spacingClasses.generated.ts)の照合。
// 実行: pnpm test scripts/structure/styles/spacingClasses.test.mjs
//
// 守りたい契約:
// 1. 段の名前の一覧 = none 0 / 2xs 4 / xs 8 / sm 12 / md 16 / lg 24 / xl 32 / 2xl 40 / 3xl 48 / 4xl 64px(小さい順)
// 2. 表のファイルは一覧から作り直した物と 1 字も違わない(名前の足し引き・手での書き換えで落ちる → pnpm generate styles)
// 3. 表は 9 prop × 6 幅 × 10 名前の全部の組を、Tailwind が読める字面(gap-(--space-md)・sm:gap-(--space-md))で持つ
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SPACING_CLASSES } from "@/components/Layout/spacingClasses.generated";
import { SPACING_BREAKPOINTS, SPACING_NAMES, SPACING_PROP_UTILITIES, SPACING_SCALE } from "@/components/Layout/spacingScale";

import { buildSpacingClasses, listSpacingClasses, renderSpacingClasses, SPACING_CLASSES_OUTPUT } from "./spacingClasses.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("段の名前の一覧は依頼書の 10 段(小さい順)", () => {
  assert.deepEqual(Object.entries(SPACING_SCALE), [
    ["none", 0],
    ["2xs", 4],
    ["xs", 8],
    ["sm", 12],
    ["md", 16],
    ["lg", 24],
    ["xl", 32],
    ["2xl", 40],
    ["3xl", 48],
    ["4xl", 64],
  ]);
  assert.deepEqual([...SPACING_BREAKPOINTS], ["base", "sm", "md", "lg", "xl", "2xl"]);
  assert.deepEqual(Object.keys(SPACING_PROP_UTILITIES), [
    "gap", "gapX", "gapY", "padding", "paddingBlock", "paddingInline", "margin", "marginBlock", "marginInline",
  ]);
});

test("表のファイルは一覧から作り直した物と一致する(違えば pnpm generate styles)", () => {
  const onDisk = readFileSync(resolve(repoRoot, SPACING_CLASSES_OUTPUT), "utf8");
  assert.equal(onDisk, renderSpacingClasses());
  assert.deepEqual(SPACING_CLASSES, buildSpacingClasses());
});

test("表は全部の組を字面で持つ(9 × 6 × 10 = 540、重なりなし)", () => {
  const all = listSpacingClasses();
  assert.equal(all.length, 9 * 6 * 10);
  assert.equal(new Set(all).size, all.length);
  assert.equal(SPACING_CLASSES.gap.base.md, "gap-(--space-md)");
  assert.equal(SPACING_CLASSES.gap.sm.md, "sm:gap-(--space-md)");
  assert.equal(SPACING_CLASSES.gapX["2xl"]["4xl"], "2xl:gap-x-(--space-4xl)");
  assert.equal(SPACING_CLASSES.paddingBlock.base.none, "py-(--space-none)");
  assert.equal(SPACING_CLASSES.marginInline.lg["2xs"], "lg:mx-(--space-2xs)");
  for (const prop of Object.keys(SPACING_CLASSES)) {
    for (const breakpoint of SPACING_BREAKPOINTS) {
      assert.deepEqual(Object.keys(SPACING_CLASSES[prop][breakpoint]), SPACING_NAMES, `${prop}.${breakpoint}`);
    }
  }
});

test("一覧から名前を 1 つ外した表は、ファイルと食い違う", () => {
  const table = buildSpacingClasses();
  for (const byBreakpoint of Object.values(table)) for (const byName of Object.values(byBreakpoint)) delete byName["3xl"];
  assert.notEqual(renderSpacingClasses(table), readFileSync(resolve(repoRoot, SPACING_CLASSES_OUTPUT), "utf8"));
});
