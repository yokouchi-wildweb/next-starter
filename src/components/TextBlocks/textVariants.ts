// src/components/TextBlocks/textVariants.ts

import { cva } from "class-variance-authority";

/**
 * 文字色。意味色は本文用トークン(text-{x}-text)を使う(塗り用トークンを文字色にしない)。
 * 色の値は src/styles/palette.defaults.css(既定)/ custom/palette.css(下流)で決まる。
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
} as const;

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
} as const;

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
} as const;

export const align = {
  inherit: "",
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
  centerToStartSm: "text-center sm:text-left",
} as const;

export const srOnly = {
  true: "sr-only",
  false: "",
} as const;

export const createTextVariants = (baseClass: string) =>
  cva(baseClass, {
    variants: {
      tone,
      size,
      weight,
      align,
      srOnly,
    },
  });
