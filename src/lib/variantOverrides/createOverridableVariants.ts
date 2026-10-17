// src/lib/variantOverrides/createOverridableVariants.ts
//
// cva と同じ引数で variant 関数を作り、出力の後ろに下流のオーバーライドを結合する。
// 返り値の関数は cva のそれと同じシグネチャなので、VariantProps<typeof x> もそのまま使える。
// 消費側(Button / LinkButton / PseudoButton など buttonVariants を呼ぶ全員)は何も変えなくてよい。

import { cva } from "class-variance-authority";

import { cn } from "@/lib/cn";

import { variantOverrideClasses } from "./defineConfig";
import type { VariantOverride } from "./types";

type Cva<T> = typeof cva<T>;
type CvaBase = Parameters<typeof cva>[0];
type CvaConfig<T> = Parameters<Cva<T>>[1];
type CvaProps<T> = Parameters<ReturnType<Cva<T>>>[0];

/**
 * props の軸(variant / size)を cva と同じ規則で解決する:
 * undefined / "" → defaultVariants の値、null → 無し(cva も null は「この軸を当てない」)。
 */
function resolveAxis(
  props: Record<string, unknown>,
  defaults: Record<string, unknown>,
  axis: "variant" | "size",
): string | null | undefined {
  const value = props[axis];
  if (value === null) return null;
  const resolved = value === undefined || value === "" ? defaults[axis] : value;
  return resolved == null ? undefined : String(resolved);
}

/**
 * @param base cva の第 1 引数(基底クラス)
 * @param config cva の第 2 引数(variants / compoundVariants / defaultVariants)
 * @param override 下流のオーバーライド(src/config/ui/variants.config.ts の該当キー)
 *
 * 結合順: cva 出力 → override.base → override.variant[v] → override.size[s] → props.class → props.className
 * tailwind-merge(cn)が同プロパティの衝突を後勝ちで解決するので、呼び出し側の className は従来どおり最後に勝つ。
 */
export function createOverridableVariants<T>(
  base: CvaBase,
  config: CvaConfig<T>,
  override: VariantOverride<string, string>,
): (props?: CvaProps<T>) => string {
  const variants = cva<T>(base, config);
  const defaults = ((config as { defaultVariants?: Record<string, unknown> } | undefined)?.defaultVariants ??
    {}) as Record<string, unknown>;

  return (props) => {
    const { className, class: classProp, ...rest } = (props ?? {}) as Record<string, unknown>;
    const variant = resolveAxis(rest, defaults, "variant");
    const size = resolveAxis(rest, defaults, "size");
    return cn(
      variants(rest as CvaProps<T>),
      ...variantOverrideClasses(override, { variant, size }),
      classProp as string | undefined,
      className as string | undefined,
    );
  };
}
