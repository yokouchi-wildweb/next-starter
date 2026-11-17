// 選ぶ欄の引き金の高さの検査(操作部品の高さの段 --control-h-*、余白の議会 D46 K1)。
// - SelectInput・ComboboxInput・MultiSelectInput(の引き金 MultiSelectTrigger)は size xs〜xl(既定 md)を受け、
//   引き金の高さは h-(--control-h-<size>) py-0(同じ size の Input と同じ)。旧 !h-auto・h-auto py-3 は無い
// - SelectInput は素の層に size="none" を渡す(data-[size=…]:h-… の詳細度に負けないよう、高さは上の層が付ける)
// - 素の層の SelectTrigger: default = h-(--control-h-sm)(36px)、sm = h-(--control-h-xs)(32px)、none = 高さなし
// - 上書きの口 input と className の高さが勝つ
// 実行: pnpm test src/components/Form/Input/Manual/selectHeight.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";

import { defineVariantOverrides, type VariantOverrides } from "@/lib/variantOverrides";

const OV: VariantOverrides = defineVariantOverrides({});
mock.module("@/config/ui/variants.config", { namedExports: { VARIANT_OVERRIDES: OV } });

let render: typeof import("react-dom/server").renderToStaticMarkup;
let SelectInput: typeof import("./Select").SelectInput;
let ComboboxInput: typeof import("./ComboboxInput").ComboboxInput;
let MultiSelectInput: typeof import("./MultiSelectInput").MultiSelectInput;
let P: typeof import("@/components/Primitives/Select");
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ SelectInput } = await import("./Select"));
  ({ ComboboxInput } = await import("./ComboboxInput"));
  ({ MultiSelectInput } = await import("./MultiSelectInput"));
  P = await import("@/components/Primitives/Select");
});

const noop = () => {};
const OPTIONS = [{ value: "a", label: "A" }];
/** 引き金の要素(select-trigger の印か role=combobox の button)の class */
const triggerClasses = (html: string) => {
  const tag = /<button[^>]*(data-slot="select-trigger"|role="combobox"|aria-haspopup="(?:listbox|dialog)")[^>]*>/.exec(html)?.[0] ?? "";
  return { tag, classes: (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean) };
};
const heights = (classes: string[]) => classes.filter((c) => /^(h|py|!h)-/.test(c));
const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

const triggers = {
  SelectInput: (size?: (typeof SIZES)[number], className?: string) => h(SelectInput, { onChange: noop, options: OPTIONS, size, className }),
  ComboboxInput: (size?: (typeof SIZES)[number]) => h(ComboboxInput, { onChange: noop, options: OPTIONS, size }),
  MultiSelectInput: (size?: (typeof SIZES)[number]) => h(MultiSelectInput, { onChange: noop, options: OPTIONS, size }),
};

test("引き金は size xs〜xl の高さを --control-h-<size> から取り、py-0。既定 md、旧 h-auto / py-3 は無い", () => {
  for (const [name, make] of Object.entries(triggers)) {
    for (const size of SIZES) {
      assert.deepEqual(heights(triggerClasses(render(make(size))).classes), [`h-(--control-h-${size})`, "py-0"], `${name} ${size}`);
    }
    const plain = triggerClasses(render(make())).classes;
    assert.deepEqual(heights(plain), ["h-(--control-h-md)", "py-0"], `${name} 既定`);
    assert.ok(!plain.includes("h-auto") && !plain.includes("py-3") && !plain.includes("!h-auto"), name);
  }
});

test("SelectInput は素の層に size=none を渡す(data-[size=…] の高さが付かない)", () => {
  const { tag } = triggerClasses(render(triggers.SelectInput("xs")));
  assert.match(tag, /data-size="none"/);
});

test("素の層の SelectTrigger: default 36px・sm 32px は段のトークン、none は高さを付けない", () => {
  const trigger = (size?: "default" | "sm" | "none") =>
    render(h(P.Select, null, h(P.SelectTrigger, { size }, h(P.SelectValue, { placeholder: "x" }))));
  const all = triggerClasses(trigger()).classes;
  assert.ok(all.includes("data-[size=default]:h-(--control-h-sm)") && all.includes("data-[size=sm]:h-(--control-h-xs)"));
  assert.match(triggerClasses(trigger("sm")).tag, /data-size="sm"/);
  assert.match(triggerClasses(trigger("none")).tag, /data-size="none"/);
});

test("上書きの口 input と className の高さが引き金でも勝つ", () => {
  try {
    Object.assign(OV.input, { size: { md: "h-12" } });
    for (const [name, make] of Object.entries(triggers)) {
      const classes = triggerClasses(render(make())).classes;
      assert.ok(classes.includes("h-12") && !classes.includes("h-(--control-h-md)"), name);
    }
  } finally {
    for (const key of Object.keys(OV.input)) delete (OV.input as Record<string, unknown>)[key];
  }
  assert.deepEqual(heights(triggerClasses(render(triggers.SelectInput("md", "h-auto py-2"))).classes), ["h-auto", "py-2"]);
});
