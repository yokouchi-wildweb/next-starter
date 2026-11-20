// src/lib/variantOverrides/index.ts
//
// 棚の部品(Button / Badge / 入力部品 / TextBlocks)の variant を、core を編集せずに差し替えるための仕組み。
// 下流は上書き src/config/lib/variantOverrides.config.ts に差分だけ書く(合成済みの値 = ./config.ts の variantOverrides)。
// 軸の値の名前の型はここ(./types.ts)が持ち、棚が読む。この lib は棚を読まない。説明: README.md
// 詳細: src/styles/Extension.md「バリアントの上書き(variants.config.ts)」

export { defineVariantOverrides, variantOverrideClasses } from "./defineConfig";
export { createOverridableVariants } from "./createOverridableVariants";
export type {
  AxisOverride,
  BadgeKindOverride,
  BadgeSize,
  BadgeVariant,
  ButtonSizeName,
  ButtonVariantName,
  CheckControlOverride,
  CheckControlSize,
  InputOverride,
  InputSize,
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
  TabletButtonSizeName,
  TabletButtonVariantName,
  TextWeight,
  VariantOverride,
  VariantOverrides,
  VariantOverridesInput,
} from "./types";
