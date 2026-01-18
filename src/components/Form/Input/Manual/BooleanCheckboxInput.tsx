// src/components/Form/Manual/BooleanCheckboxInput.tsx

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

type Props = {
  field: {
    value?: boolean | null;
    name?: string;
    onChange: (value: boolean) => void;
  };
  label?: ReactNode;
  /**
   * チェックボックス本体のサイズ
   */
  size?: CheckboxSizeProps["size"];
} & Omit<ComponentProps<typeof Checkbox>, "checked" | "defaultChecked" | "onCheckedChange" | "value">;

export function BooleanCheckboxInput({ field, label, id, className, size, ...rest }: Props) {
  const checkboxId = id ?? field.name ?? undefined;
  const checkbox = (
    <Checkbox
      id={checkboxId}
      className={cn(checkboxSizeVariants({ size }), className)}
      checked={Boolean(field.value)}
      onCheckedChange={(value) => field.onChange(value === true)}
      {...rest}
    />
  );

  if (!label) {
    return checkbox;
  }

  return (
    <div className="flex items-center gap-2">
      {checkbox}
      <Label htmlFor={checkboxId} className={checkboxId ? "cursor-pointer" : undefined}>
        {label}
      </Label>
    </div>
  );
}
