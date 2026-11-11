// @/components/Form/Input/Manual/SingleCardCheckbox.tsx

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { VariantProps } from "class-variance-authority";
import { Checkbox } from "@/components/Primitives/Checkbox";
import type { FormControlA11yProps } from "@/components/Form/Field/types";
import { VARIANT_OVERRIDES } from "@/config/ui/variants.config";
import {
  createOverridableVariants,
  type CheckControlSize,
  type SingleCardCheckboxColor,
} from "@/lib/variantOverrides";

// 見た目の上書き口: src/config/ui/variants.config.ts の singleCardCheckbox({ base, size, color })。
// color は今使っている色(チェック時 checkedVariant、未チェック時 uncheckedVariant)のときだけ足す。既定のクラスはここ

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
} as const satisfies Record<SingleCardCheckboxColor, string>;

type ColorVariant = keyof typeof colorVariants;

/**
 * サイズバリアント
 */
const SIZE = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-3 text-sm",
  lg: "px-5 py-4 text-base",
} satisfies Record<CheckControlSize, string>;

const sizeVariants = createOverridableVariants(
  "",
  { variants: { size: SIZE }, defaultVariants: { size: "md" } },
  VARIANT_OVERRIDES.singleCardCheckbox,
);

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
} & FormControlA11yProps; // id・aria-* はチェックボックスへ

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
  id,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
}: SingleCardCheckboxProps) {
  const isChecked = Boolean(value);
  const currentVariant = isChecked ? checkedVariant : uncheckedVariant;

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border transition-colors",
        sizeVariants({ size }),
        colorVariants[currentVariant],
        VARIANT_OVERRIDES.singleCardCheckbox.color?.[currentVariant],
        fullWidth && "w-full",
        centered && "justify-center",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Checkbox
        id={id}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid}
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
