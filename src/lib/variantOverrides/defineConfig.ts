// src/lib/variantOverrides/defineConfig.ts
//
// 下流の差分を完全形に正規化する。設定ファイル(src/config/ui/variants.config.ts)は
// この関数を 1 回呼ぶだけにし、ロジックを持たない(CLAUDE.md: config は値のみ)。

import type { VariantOverride, VariantOverrides, VariantOverridesInput } from "./types";

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
  };
}

/**
 * オーバーライドから、現在の variant / size に該当するクラスを順に取り出す。
 * 返り値をそのまま cn() に展開する(cva 出力の後、呼び出し側 className の前)。
 * variant / size が未解決(undefined)の軸はスキップする。
 */
export function variantOverrideClasses(
  override: VariantOverride<string, string> | undefined,
  resolved: { variant?: string | null; size?: string | null },
): (string | undefined)[] {
  if (!override) return [];
  const { variant, size } = resolved;
  return [
    override.base,
    variant != null ? override.variant?.[variant] : undefined,
    size != null ? override.size?.[size] : undefined,
  ];
}
