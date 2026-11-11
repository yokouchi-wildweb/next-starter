// src/lib/variantOverrides/index.ts
//
// 棚の部品(Button / Badge / 入力部品 / TextBlocks)の variant を、core を編集せずに差し替えるための仕組み。
// 下流は src/config/ui/variants.config.ts に defineVariantOverrides({ ... }) で差分だけ書く。
// 詳細: src/styles/README.md「variant オーバーライド」

export { defineVariantOverrides, variantOverrideClasses } from "./defineConfig";
export { createOverridableVariants } from "./createOverridableVariants";
export type {
  AxisOverride,
  BadgeKindOverride,
  CheckControlOverride,
  CheckControlSize,
  SingleCardCheckboxColor,
  SingleCardCheckboxOverride,
  StepperInputOverride,
  StepperInputSize,
  SwitchInputColor,
  SwitchInputIndicatorOverride,
  SwitchInputTrackOverride,
  TextAlign,
  TextBlockOverride,
  TextSize,
  TextTone,
  TextWeight,
  VariantOverride,
  VariantOverrides,
  VariantOverridesInput,
} from "./types";
