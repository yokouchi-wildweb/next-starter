// src/components/Badge/bookmark-tag-badge-variants.ts

import { cva, type VariantProps } from "class-variance-authority";

import { badgeSizeVariants } from "./badge-variants";

export const bookmarkTagBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-none border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none transition-colors",
  {
    variants: {
      variant: {
        // 標準のプライマリバッジ
        primary: "bg-primary text-primary-foreground border-primary",
        // 補助情報向けのセカンダリバッジ
        secondary: "bg-secondary text-secondary-foreground border-secondary",
        // エラーや削除など警告を示すバッジ
        destructive: "bg-destructive text-white border-destructive",
        // 成功・完了・有効を示すバッジ
        success: "bg-success text-success-foreground border-success",
        // 情報・通知を示す青系バッジ
        info: "bg-info text-info-foreground border-info",
        // 注意・警告を示すアンバー系バッジ
        warning: "bg-warning text-warning-foreground border-warning",
        // 強調・注目を引くアクセントバッジ
        accent: "bg-accent text-accent-foreground border-accent",
        // 非アクティブ・下書きなど控えめな状態を示すバッジ
        muted: "bg-muted text-muted-foreground border-border",
        // 枠線のみのシンプルなバッジ
        outline: "bg-background text-foreground border-border",
        // 透明背景のゴーストバッジ
        ghost: "bg-transparent text-foreground border-transparent",
      },
      size: badgeSizeVariants,
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type BookmarkTagBadgeVariantProps = VariantProps<
  typeof bookmarkTagBadgeVariants
>;
