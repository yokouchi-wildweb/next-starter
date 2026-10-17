// src/components/TextBlocks/textVariants.ts

import { cva } from "class-variance-authority";

/**
 * 文字色。意味色は本文用トークン(text-{x}-text)を使う(塗り用トークンを文字色にしない)。
 * 色の値は src/styles/palette.defaults.css(既定)/ custom/palette.css(下流)で決まる。
 *
 * 互換エイリアス(@deprecated、同じトークンに解決): notice / caution → warning、error / danger → destructive。
 * 新規コードでは warning / destructive を使う。削除時は .notices で通知する。
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
  /** @deprecated warning を使う */
  notice: "text-warning-text",
  /** @deprecated warning を使う */
  caution: "text-warning-text",
  /** @deprecated destructive を使う */
  error: "text-destructive-text",
  /** @deprecated destructive を使う */
  danger: "text-destructive-text",
} as const;

export const size = {
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
