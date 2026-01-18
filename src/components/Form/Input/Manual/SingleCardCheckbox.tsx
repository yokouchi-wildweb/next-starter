// @/components/Form/Input/Manual/SingleCardCheckbox.tsx

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { Checkbox } from "@/components/_shadcn/checkbox";

/**
 * カラーバリアント
 */
const colorVariants = {
  success: "bg-success/20 border-success",
  primary: "bg-primary/20 border-primary",
  secondary: "bg-secondary/20 border-secondary",
  accent: "bg-accent/20 border-accent",
  destructive: "bg-destructive/20 border-destructive",
  muted: "bg-muted/50 border-border",
  outline: "bg-background border-border",
} as const;

type ColorVariant = keyof typeof colorVariants;

/**
 * サイズバリアント
 */
const sizeVariants = cva("", {
  variants: {
    size: {
      sm: "px-3 py-2 text-sm",
      md: "px-4 py-3 text-sm",
      lg: "px-5 py-4 text-base",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type SizeVariant = VariantProps<typeof sizeVariants>["size"];

export type SingleCardCheckboxProps = {
  /** 現在の値 */
  value?: boolean | null;
  /** フィールド名 */
  name?: string;
  /** 値が変更されたときのコールバック */
  onChange: (value: boolean) => void;
  /** ラベル（ReactNode） */
  label: ReactNode;
  /** 未チェック時のカラーバリアント */
  uncheckedVariant?: ColorVariant;
  /** チェック時のカラーバリアント */
  checkedVariant?: ColorVariant;
  /** サイズ */
  size?: SizeVariant;
  /** 幅を最大にする */
  fullWidth?: boolean;
  /** 中央揃え */
  centered?: boolean;
  /** 無効化 */
  disabled?: boolean;
  /** 追加のクラス名 */
  className?: string;
};

export function SingleCardCheckbox({
  value,
  name,
  onChange,
  label,
  uncheckedVariant = "muted",
  checkedVariant = "secondary",
  size = "md",
  fullWidth = true,
  centered = true,
  disabled = false,
  className,
}: SingleCardCheckboxProps) {
  const isChecked = Boolean(value);
  const currentVariant = isChecked ? checkedVariant : uncheckedVariant;

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border transition-colors",
        sizeVariants({ size }),
        colorVariants[currentVariant],
        fullWidth && "w-full",
        centered && "justify-center",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={(checked) => {
          if (!disabled) {
            onChange(checked === true);
          }
        }}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
