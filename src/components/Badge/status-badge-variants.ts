// src/components/Badge/status-badge-variants.ts

import { cva, type VariantProps } from "class-variance-authority";

export const statusBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // 標準のプライマリバッジ
        default:
          "border-transparent bg-primary text-primary-foreground",
        // 補助情報向けのセカンダリバッジ
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        // エラーや削除など警告を示すバッジ
        destructive:
          "border-transparent bg-destructive text-white dark:bg-destructive/60",
        // 成功・完了・有効を示すバッジ
        success:
          "border-transparent bg-success text-success-foreground",
        // 強調・注目を引くアクセントバッジ
        accent:
          "border-transparent bg-accent text-accent-foreground",
        // 非アクティブ・下書きなど控えめな状態を示すバッジ
        muted:
          "border-transparent bg-muted text-muted-foreground",
        // 枠線のみのシンプルなバッジ
        outline:
          "text-foreground border-border",
        // 透明背景のゴーストバッジ
        ghost:
          "border-transparent text-foreground",
      },
      size: {
        // コンパクトUI向けの小サイズ
        sm: "px-2 py-0.5 text-xs gap-1 [&>svg]:size-3",
        // 標準サイズ
        md: "px-3 py-1 text-xs gap-1.5 [&>svg]:size-3.5",
        // 強調表示向けの大サイズ
        lg: "px-4 py-1.5 text-sm gap-2 [&>svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export type StatusBadgeVariantProps = VariantProps<typeof statusBadgeVariants>;
