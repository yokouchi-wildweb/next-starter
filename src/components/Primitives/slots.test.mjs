// 実行: pnpm test src/components/Primitives/slots.test.mjs
// Primitives の印(data-slot)の約束の照合: 部品ごとに README の「## data-slot の一覧」= 部品のファイルの印の字面(片方にしか無い名前は失敗)。
// 名前は shadcn の形(<部品の kebab> か <部品の kebab>-<部位>。Input の textarea だけ例外)、部品をまたいで同じ名前は無い。
// 枠の照合(UserFrame / AdminFrame)の shadcn の印との衝突の検査も同じ一覧(./slots.mjs の allPrimitiveSlots)を読む
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { readFileSync } from "node:fs";

import { allPrimitiveSlots, attributeSlotsOf, marksBeforeSpreadOf, readmeSlotsOf, readUnitSlots, typedSlotsOf } from "./slots.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const kebab = (name) => name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
/** shadcn の形の例外(部品 → 許す名前) */
const NAME_EXCEPTIONS = { Input: ["textarea"], Badge: ["solid-badge", "bookmark-tag-badge"], Label: ["form-label"], Skeleton: ["image-viewer-skeleton"] };

test("読み手: 属性の字面だけを数え、セレクタの文字列は数えない。README の節の行を読む", () => {
  assert.deepEqual(attributeSlotsOf(`<div data-slot="a-b" />\n  data-slot="c"\nclosest('[data-slot="dialog-overlay"]')`), ["a-b", "c"]);
  assert.deepEqual(readmeSlotsOf("# X\n\n## data-slot の一覧\n\n- `x` — 説明\n- `x-y` — 説明\n\n## 次\n- `z`"), ["x", "x-y"]);
  assert.equal(readmeSlotsOf("# X\n"), null);
});

test("部品ごと: README の一覧 = 部品のファイルの印(17 部品、Slot は印なし)", () => {
  const units = readUnitSlots(repoRoot);
  assert.equal(units.length, 17, units.map((u) => u.unit).join(","));
  for (const { unit, listed, used } of units) {
    assert.ok(listed, `${unit}: README.md の「## data-slot の一覧」が無い`);
    assert.equal(new Set(listed).size, listed.length, `${unit}: 一覧に重なり`);
    assert.deepEqual([...listed].sort(), [...used].sort(), `${unit}: README の一覧と部品の印が合わない`);
  }
  assert.deepEqual(units.find((u) => u.unit === "Slot")?.listed, []);
});

test("名前: shadcn の形(<部品>・<部品>-<部位>)で、部品をまたいで重ならない", () => {
  const seen = new Map();
  for (const { unit, listed } of readUnitSlots(repoRoot)) {
    const base = kebab(unit);
    for (const name of listed ?? []) {
      const ok = name === base || name.startsWith(`${base}-`) || (NAME_EXCEPTIONS[unit] ?? []).includes(name);
      assert.ok(ok, `${unit}: ${name} は ${base} / ${base}-<部位> の形でない`);
      assert.ok(!seen.has(name), `${name} が ${seen.get(name)} と ${unit} の両方にある`);
      seen.set(name, unit);
    }
  }
  assert.ok(allPrimitiveSlots(repoRoot).includes("button"));
});

test("読み手: 型つきの値の名前と、呼び手の広げより前の印を読む", () => {
  assert.deepEqual(typedSlotsOf(`export type LabelSlot = "label" | "form-label";`), ["label", "form-label"]);
  assert.deepEqual(marksBeforeSpreadOf(`<A data-slot="a" {...props} />\n<B {...props} data-slot="b" />\n<C\n  data-slot={slot}\n  {...rest}\n/>`), ['"a"', "{slot}"]);
});

test("部品の印が勝つ: どの部品も印を呼び手の props の広げより後ろに置く", () => {
  for (const { unit, beforeSpread } of readUnitSlots(repoRoot)) {
    assert.deepEqual(beforeSpread, [], `${unit}: 呼び手の props より前に置いた印 ${beforeSpread.join(", ")}`);
  }
});

test("Button が枠に貸す名前(export しない FrameButtonSlot)は枠の README の一覧にあり、Primitives の一覧に無い", () => {
  const source = readFileSync(resolve(repoRoot, "src/components/Primitives/Button/Button.tsx"), "utf8");
  const m = /^type FrameButtonSlot\s*=\s*([^;]+);/m.exec(source);
  assert.ok(m, "Button.tsx に FrameButtonSlot が無い");
  const lent = [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((n) => n[1]);
  assert.deepEqual(lent, ["bottom-nav-item"]);
  assert.match(source, /export type ButtonSlot\s*=[^;]*\bFrameButtonSlot\b/, "ButtonSlot に FrameButtonSlot が入っていない");
  const frame = readmeSlotsOf(readFileSync(resolve(repoRoot, "src/app/(user)/_layout/README.md"), "utf8")) ?? [];
  const primitives = allPrimitiveSlots(repoRoot);
  for (const name of lent) {
    assert.ok(frame.includes(name), `${name} が枠の README の一覧に無い`);
    assert.equal(primitives.includes(name), false, `${name} が Primitives の一覧にある(持ち主は枠)`);
  }
  assert.deepEqual(typedSlotsOf(source), ["button"], "export しない型の名前は Button の印に数えない");
});
