import { cva } from "class-variance-authority";

const textToneVariants = {
  // default: 標準的な本文テキスト。
  default: "",
  // muted: 補足説明などトーンを抑えたい本文。
  muted: "text-muted-foreground",
  // label: 見出しと本文の間を埋める簡易ラベル。
  label: "font-semibold",
  // notice: 警告や注意喚起を示すテキスト。
  notice: "text-amber-600",
  // error: エラー表示や警告ダイアログで使用する際の強調テキスト。
  error: "text-destructive",
} as const;

const textSizeVariants = {
  // default: 標準的な本文サイズ。
  default: "text-base",
  // lead: セクション冒頭で少し大きめに見せたい本文。
  lead: "text-lg",
  // sm: 注意書きなど小さめで読みやすくしたい本文。
  sm: "text-sm",
  // xs: キャプションや補足ラベル向けの極小テキスト。
  xs: "text-xs",
} as const;

const textAlignVariants = {
  // left: 左寄せの標準的なテキスト揃え。
  left: "text-left",
  // center: 中央揃えで均等に見せたいときに使用。
  center: "text-center",
  // justify: 行全体を整えたいときに使用。
  justify: "text-justify",
  // centerToStartSm: モバイルでは中央、SM以上では左寄せにする場合に使用。
  centerToStartSm: "text-center sm:text-left",
} as const;

const textVariantDefaults = {
  tone: "default",
  size: "default",
} as const;

const textAlignDefault = "left" as const;

export const createTextVariants = (baseClass: string) =>
  cva(baseClass, {
    variants: {
      tone: textToneVariants,
      size: textSizeVariants,
      align: textAlignVariants,
    },
    defaultVariants: {
      ...textVariantDefaults,
      align: textAlignDefault,
    },
  });

export {
  textToneVariants,
  textSizeVariants,
  textAlignVariants,
  textVariantDefaults,
  textAlignDefault,
};
