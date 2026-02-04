// src/components/Badge/solid-badge-variants.ts

import { cva, type VariantProps } from "class-variance-authority";

import { badgeSizeVariants } from "./badge-variants";

export const solidBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // 標準のプライマリバッジ
        primary: "bg-primary text-primary-foreground",
        // 補助情報向けのセカンダリバッジ
        secondary: "bg-secondary text-secondary-foreground",
        // エラーや削除など警告を示すバッジ
        destructive: "bg-destructive text-white",
        // 成功・完了・有効を示すバッジ
        success: "bg-success text-success-foreground",
        // 情報・通知を示す青系バッジ
        info: "bg-info text-info-foreground",
        // 注意・警告を示すアンバー系バッジ
        warning: "bg-warning text-warning-foreground",
        // 強調・注目を引くアクセントバッジ
        accent: "bg-accent text-accent-foreground",
        // 非アクティブ・下書きなど控えめな状態を示すバッジ
        muted: "bg-muted text-muted-foreground",
        // 枠線のみのシンプルなバッジ
        outline: "bg-background text-foreground border border-border",
        // 透明背景のゴーストバッジ
        ghost: "bg-transparent text-foreground",
      },
      size: badgeSizeVariants,
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type SolidBadgeVariantProps = VariantProps<typeof solidBadgeVariants>;
