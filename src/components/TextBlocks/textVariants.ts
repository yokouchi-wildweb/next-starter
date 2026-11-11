// src/components/TextBlocks/textVariants.ts

import {
  createOverridableVariants,
  type TextAlign,
  type TextBlockOverride,
  type TextSize,
  type TextTone,
  type TextWeight,
} from "@/lib/variantOverrides";

/**
 * 文字色。意味色は本文用トークン(text-{x}-text)を使う(塗り用トークンを文字色にしない)。
 * 色の値は src/styles/core/palette.css(既定)/ src/styles/palette.css(下流)で決まる。
 */
export const tone = {
  inherit: "text-inherit",
  default: "text-foreground",
  muted: "text-muted-foreground",
  accent: "text-accent",
  primary: "text-primary",
  secondary: "text-secondary",
  destructive: "text-destructive-text",
  success: "text-success-text",
  info: "text-info-text",
  warning: "text-warning-text",
} as const satisfies Record<TextTone, string>;

// inherit = クラスを出さない(親の値がそのまま効く)。見出しの中の Span、中央寄せの親の中の Para などに使う。
// size / weight / align の既定値は各コンポーネント側で決める(Span / Para は md / normal、Para の align は left)。

export const size = {
  inherit: "",
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  xxl: "text-2xl",
  xxxl: "text-3xl",
  // 流体サイズ (theme.css --text-fluid-*、ビューポート短辺に比例。キオスク・サイネージ向け)
  // 4xl / 5xl 相当は見出し用途なので className="text-fluid-4xl" 等で指定する
  fluidXs: "text-fluid-xs",
  fluidSm: "text-fluid-sm",
  fluidMd: "text-fluid-base",
  fluidLg: "text-fluid-lg",
  fluidXl: "text-fluid-xl",
  fluidXxl: "text-fluid-2xl",
  fluidXxxl: "text-fluid-3xl",
} as const satisfies Record<TextSize, string>;

export const weight = {
  inherit: "",
  thin: "font-thin",
  extraLight: "font-extralight",
  light: "font-light",
  normal: "font-normal",
  medium: "font-medium",
  semiBold: "font-semibold",
  bold: "font-bold",
  extraBold: "font-extrabold",
  black: "font-black",
} as const satisfies Record<TextWeight, string>;

export const align = {
  inherit: "",
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
  centerToStartSm: "text-center sm:text-left",
} as const satisfies Record<TextAlign, string>;

export const srOnly = {
  true: "sr-only",
  false: "",
} as const;

/**
 * TextBlocks の variant 関数。override = src/config/ui/variants.config.ts の部品のキー
 * (pageTitle / para / secTitle / span: { base, tone, size, weight, align })。srOnly は上書きしない。
 * 結合順: 既定のクラス → override.base → tone → size → weight → align の上書き(呼び手の className は部品側で最後)。
 */
export const createTextVariants = (baseClass: string, override: TextBlockOverride) =>
  createOverridableVariants(
    baseClass,
    {
      variants: {
        tone,
        size,
        weight,
        align,
        srOnly,
      },
    },
    override,
  );
