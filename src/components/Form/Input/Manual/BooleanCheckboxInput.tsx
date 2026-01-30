// @/components/Form/Input/Manual/BooleanCheckboxInput.tsx

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Label } from "@/components/Form/Label";

const checkboxSizeVariants = cva("", {
  variants: {
    size: {
      sm: "!size-3 [&_[data-slot=checkbox-indicator]>svg]:!size-2",
      md: "!size-4 [&_[data-slot=checkbox-indicator]>svg]:!size-3.5",
      lg: "!size-5 [&_[data-slot=checkbox-indicator]>svg]:!size-4",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type CheckboxSizeProps = VariantProps<typeof checkboxSizeVariants>;

export type BooleanCheckboxInputProps = {
  /** 現在の値 */
  value?: boolean | null;
  /** フィールド名（id のフォールバックに使用） */
  name?: string;
  /** 値が変更されたときのコールバック */
  onChange: (value: boolean) => void;
  /** フォーカスが外れたときのコールバック（値変更後に発火） */
  onBlur?: () => void;
  label?: ReactNode;
  /**
   * チェックボックス本体のサイズ
   */
  size?: CheckboxSizeProps["size"];
  /** 無効化 */
  disabled?: boolean;
} & Omit<ComponentProps<typeof Checkbox>, "checked" | "defaultChecked" | "onCheckedChange" | "value" | "name" | "disabled">;

export function BooleanCheckboxInput({ value, name, onChange, onBlur, label, id, className, size, disabled, ...rest }: BooleanCheckboxInputProps) {
  const checkboxId = id ?? name ?? undefined;
  const checkbox = (
    <Checkbox
      id={checkboxId}
      className={cn("border-muted-foreground", checkboxSizeVariants({ size }), className)}
      checked={Boolean(value)}
      onCheckedChange={(checked) => {
        onChange(checked === true);
        onBlur?.();
      }}
      disabled={disabled}
      {...rest}
    />
  );

  if (!label) {
    return checkbox;
  }

  return (
    <div className="flex items-center gap-2">
      {checkbox}
      <Label
        htmlFor={checkboxId}
        className={cn(
          checkboxId ? "cursor-pointer" : undefined,
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {label}
      </Label>
    </div>
  );
}
