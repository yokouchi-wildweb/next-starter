// src/components/Form/manual/BooleanCheckboxInput.tsx

import type { ComponentProps, ReactNode } from "react";
import { Checkbox } from "@/components/Shadcn/checkbox";
import { Label } from "@/components/Form/Label";

type Props = {
  field: {
    value?: boolean | null;
    name?: string;
    onChange: (value: boolean) => void;
  };
  label?: ReactNode;
} & Omit<ComponentProps<typeof Checkbox>, "checked" | "defaultChecked" | "onCheckedChange" | "value">;

export function BooleanCheckboxInput({ field, label, id, className, ...rest }: Props) {
  const checkboxId = id ?? field.name ?? undefined;
  const checkbox = (
    <Checkbox
      id={checkboxId}
      className={className}
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
