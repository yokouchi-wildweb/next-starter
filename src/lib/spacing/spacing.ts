// src/lib/spacing/spacing.ts
//
// 余白 prop の型と、値 → class の引き当て。
// - 値 = 段の名前(spacingScale.ts の none…4xl)か、幅別のオブジェクト { base, sm, md, lg, xl, "2xl" }(どれも省略可)
// - class は生成した表 SPACING_CLASSES から引く(組み立てない。Tailwind は字面に現れた class しか CSS にしない)
// - 同じ名前は部品が違っても同じトークン(--space-<名前>)

import { SPACING_CLASSES } from "./spacingClasses.generated";
import { SPACING_BREAKPOINTS, type SpacingBreakpoint, type SpacingName, type SpacingProp } from "./spacingScale";

/** 余白 prop の値: 段の名前、または幅別の段の名前 */
export type SpacingValue = SpacingName | Partial<Record<SpacingBreakpoint, SpacingName>>;

/** 箱の外と内の余白(全 Layout 部品が受ける) */
export type BoxSpacingProps = {
  padding?: SpacingValue | null;
  paddingBlock?: SpacingValue | null;
  paddingInline?: SpacingValue | null;
  margin?: SpacingValue | null;
  marginBlock?: SpacingValue | null;
  marginInline?: SpacingValue | null;
};

const BOX_SPACING_PROPS = ["padding", "paddingBlock", "paddingInline", "margin", "marginBlock", "marginInline"] as const;

/** 1 つの余白 prop の値 → class(未指定は空文字。幅別は base → 2xl の順) */
export function spacingClassName(prop: SpacingProp, value: SpacingValue | null | undefined): string {
  if (value == null) return "";
  const table = SPACING_CLASSES[prop];
  if (typeof value === "string") return table.base[value] ?? "";
  const classes: string[] = [];
  for (const breakpoint of SPACING_BREAKPOINTS) {
    const name = value[breakpoint];
    if (name) classes.push(table[breakpoint][name]);
  }
  return classes.join(" ");
}

/** 箱の余白 prop 全部 → class(padding → paddingBlock → paddingInline → margin → marginBlock → marginInline の順) */
export function boxSpacingClassName(props: BoxSpacingProps): string {
  return BOX_SPACING_PROPS.map((prop) => spacingClassName(prop, props[prop]))
    .filter(Boolean)
    .join(" ");
}
