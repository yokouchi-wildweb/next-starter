// src/components/TextBlocks/textVariants.ts

import { cva } from "class-variance-authority";

export const tone = {
  default: "",
  muted: "text-muted-foreground",
  label: "font-semibold",
  notice: "text-amber-600",
  warning: "text-amber-600",
  error: "text-destructive",
  danger: "text-destructive",
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
  display: "text-3xl md:text-4xl",
} as const;

export const align = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
  centerToStartSm: "text-center sm:text-left",
} as const;

export const createTextVariants = (baseClass: string) =>
  cva(baseClass, {
    variants: {
      tone,
      size,
      align,
    },
  });
