// 欄の中の小さなボタンの大きさの検査(操作部品の高さの段 --control-h-*、余白の議会 D46 K3)。
// - Input のクリア ×・PasswordInput の表示の切り替え・DateInput / TimeInput / DatetimeInput の暦・時計のボタンは
//   欄の size(xs〜xl、既定 md)から大きさを取る正方形 size-[calc(var(--control-h-<size>)-0.5rem)]、位置は right-1
// - 欄の右の余白は pr-(--control-h-<size>)(ボタンの幅 + 4px + 4px)。旧 size-9(36px)・size-6・pr-8 / pr-10 は無い
// 実行: pnpm test src/components/Form/Input/Manual/innerButtons.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h, type ReactElement } from "react";

import { defineVariantOverrides, type VariantOverrides } from "@/lib/variantOverrides";

const OV: VariantOverrides = defineVariantOverrides({});
mock.module("@/config/ui/variants.config", { namedExports: { VARIANT_OVERRIDES: OV } });

let render: typeof import("react-dom/server").renderToStaticMarkup;
let M: {
  Input: typeof import("./Input").Input;
  PasswordInput: typeof import("./PasswordInput").PasswordInput;
  DateInput: typeof import("./DateInput").DateInput;
  TimeInput: typeof import("./TimeInput").TimeInput;
  DatetimeInput: typeof import("./DatetimeInput").DatetimeInput;
};
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  M = {
    Input: (await import("./Input")).Input,
    PasswordInput: (await import("./PasswordInput")).PasswordInput,
    DateInput: (await import("./DateInput")).DateInput,
    TimeInput: (await import("./TimeInput")).TimeInput,
    DatetimeInput: (await import("./DatetimeInput")).DatetimeInput,
  };
});

const noop = () => {};
const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
type Size = (typeof SIZES)[number];

const parts: Record<string, (size?: Size) => ReactElement> = {
  Input: (size) => h(M.Input, { value: "x", onChange: noop, onClear: noop, size }),
  PasswordInput: (size) => h(M.PasswordInput, { autoComplete: "current-password", size }),
  DateInput: (size) => h(M.DateInput, { size }),
  TimeInput: (size) => h(M.TimeInput, { size }),
  DatetimeInput: (size) => h(M.DatetimeInput, { size }),
};

const classesOf = (tag: string) => (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean);
/** 欄(input)と中のボタン(input の後ろの最初の button)の class */
const pick = (html: string) => {
  const input = /<input[^>]*>/.exec(html);
  const button = input ? /<button[^>]*>/.exec(html.slice(input.index)) : null;
  return { input: classesOf(input?.[0] ?? ""), button: classesOf(button?.[0] ?? "") };
};

test("中のボタンは欄の size から大きさを取る正方形(段 − 8px)、欄の右の余白は段の高さ", () => {
  for (const [name, make] of Object.entries(parts)) {
    for (const size of [...SIZES, undefined]) {
      const s = size ?? "md";
      const { input, button } = pick(render(make(size)));
      const sizes = button.filter((c) => /^(size|h|w)-/.test(c));
      assert.deepEqual(sizes, [`size-[calc(var(--control-h-${s})-0.5rem)]`], `${name} ${size} ボタン`);
      assert.ok(button.includes("right-1") && !button.includes("right-2"), `${name} ${size} 位置`);
      const pr = input.filter((c) => /^pr-/.test(c));
      assert.deepEqual(pr, [`pr-(--control-h-${s})`], `${name} ${size} 欄の右`);
    }
  }
});

test("className の右の余白は表より勝つ(PasswordInput)", () => {
  const { input } = pick(render(h(M.PasswordInput, { autoComplete: "current-password", className: "pr-20" })));
  assert.deepEqual(input.filter((c) => /^pr-/.test(c)), ["pr-20"]);
});
