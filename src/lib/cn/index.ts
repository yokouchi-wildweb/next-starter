// src/lib/cn/index.ts

import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * src/styles/_base/theme.css の `--text-fluid-*` トークンから生成される流体フォントサイズ。
 *
 * tailwind-merge は Tailwind 標準のクラスしか知らないため、未知の `text-*` を
 * 文字色と分類する。登録しないと `text-primary-foreground text-fluid-base` が
 * 「文字色の重複」と判定され、先の文字色が捨てられる（ラベルが背景と同色になる）。
 *
 * ⚠️ theme.css に `--text-*` トークンを追加したら必ずここにも追加する。
 *    ドリフトは pnpm test:cn（theme.css を解析して一致を検証）で検出される。
 */
export const FLUID_TEXT_SIZES = [
  "fluid-xs",
  "fluid-sm",
  "fluid-base",
  "fluid-lg",
  "fluid-xl",
  "fluid-2xl",
  "fluid-3xl",
  "fluid-4xl",
  "fluid-5xl",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FLUID_TEXT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
