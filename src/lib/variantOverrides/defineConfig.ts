// src/lib/variantOverrides/defineConfig.ts
//
// 下流の差分を完全形に正規化する。設定ファイル(src/config/ui/variants.config.ts)は
// この関数を 1 回呼ぶだけにし、ロジックを持たない(CLAUDE.md: config は値のみ)。

import type { VariantOverrides, VariantOverridesInput } from "./types";

/** どの軸のオーバーライドも読める形(base + 軸 → 値 → クラス) */
type AnyAxisOverride = { base?: string } & { [axis: string]: string | Partial<Record<string, string>> | undefined };

/**
 * 未指定のキーを空オブジェクトで埋める。消費側(Button / Badge)は `?.` 無しで参照できる。
 * 上流がキーを増やしても、下流の設定ファイルは追記不要。
 */
export function defineVariantOverrides(input: VariantOverridesInput = {}): VariantOverrides {
  return {
    button: { ...input.button },
    tabletButton: { ...input.tabletButton },
    badge: {
      size: { ...input.badge?.size },
      solid: { ...input.badge?.solid },
      soft: { ...input.badge?.soft },
      bookmarkTag: { ...input.badge?.bookmarkTag },
    },
    booleanCheckbox: { ...input.booleanCheckbox },
    booleanRadioGroup: { ...input.booleanRadioGroup },
    singleCardCheckbox: { ...input.singleCardCheckbox },
    stepperInput: { ...input.stepperInput },
    switchInput: { track: { ...input.switchInput?.track }, indicator: { ...input.switchInput?.indicator } },
    pageTitle: { ...input.pageTitle },
    para: { ...input.para },
    secTitle: { ...input.secTitle },
    span: { ...input.span },
  };
}

/**
 * オーバーライドから、現在の軸の値に該当するクラスを順に取り出す(base → resolved に書いた軸の順)。
 * 返り値をそのまま cn() に展開する(既定のクラスの後、呼び出し側 className の前)。
 * 値が未解決(undefined / null)の軸はスキップする。Button / Badge は { variant, size } を渡す(従来どおり)。
 */
export function variantOverrideClasses(
  override: object | undefined,
  resolved: Record<string, string | null | undefined>,
): (string | undefined)[] {
  if (!override) return [];
  const ov = override as AnyAxisOverride;
  const out: (string | undefined)[] = [ov.base];
  for (const [axis, value] of Object.entries(resolved)) {
    const table = ov[axis];
    out.push(value != null && table && typeof table === "object" ? table[value] : undefined);
  }
  return out;
}
