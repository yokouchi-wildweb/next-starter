// src/components/TextBlocks/textVariants.ts

import { cva } from "class-variance-authority";

export const tone = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  accent: "text-accent-foreground",
  primary: "text-primary",
  secondary: "text-secondary-foreground",
  destructive: "text-destructive",
  notice: "text-Yellow-400",
  warning: "text-amber-600",
  error: "text-red-600",
  danger: "text-red-800",
  success: "text-emerald-600",
  info: "text-sky-600",
  caution: "text-orange-500",
} as const;

export const size = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  xxl: "text-2xl",
  xxxl: "text-3xl",
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
