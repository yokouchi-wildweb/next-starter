// src/lib/variantOverrides/index.ts
//
// primitive(Button / Badge)の variant を、core を編集せずに差し替えるための仕組み。
// 下流は src/config/ui/variants.config.ts に defineVariantOverrides({ ... }) で差分だけ書く。
// 詳細: src/styles/README.md「variant オーバーライド」

export { defineVariantOverrides, variantOverrideClasses } from "./defineConfig";
export { createOverridableVariants } from "./createOverridableVariants";
export type {
  BadgeKindOverride,
  VariantOverride,
  VariantOverrides,
  VariantOverridesInput,
} from "./types";
