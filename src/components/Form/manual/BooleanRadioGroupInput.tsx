// src/components/Form/manual/BooleanRadioGroupInput.tsx

import type { ComponentProps } from "react";
import { Label } from "@/components/Form/Label";
import { RadioGroup, RadioGroupItem } from "@/components/Shadcn/radio-group";

type BooleanLike = boolean | "true" | "false";

export type BooleanRadioGroupOption = {
  label: string;
  value: BooleanLike;
};

type Props = {
  field: {
    value?: boolean | null;
    name?: string;
    onChange: (value: boolean) => void;
  };
  options?: BooleanRadioGroupOption[];
} & Omit<ComponentProps<typeof RadioGroup>, "value" | "defaultValue" | "onValueChange">;

export function BooleanRadioGroupInput({ field, options, ...rest }: Props) {
  const radioValue = typeof field.value === "boolean" ? String(field.value) : undefined;
  const normalizedOptions = (options && options.length
    ? options
    : [
        { value: true, label: "はい" },
        { value: false, label: "いいえ" },
      ]
  ).map((option) => ({
    ...option,
    value: option.value === true || option.value === "true",
  }));

  return (
    <RadioGroup
      value={radioValue}
      defaultValue={radioValue}
      onValueChange={(value) => field.onChange(value === "true")}
      {...rest}
    >
      {normalizedOptions.map((option, index) => {
        const optionValue = String(option.value);
        const optionId = `${field.name ?? rest.name ?? "boolean-radio"}-${optionValue}-${index}`;

        return (
          <div key={optionId} className="flex items-center gap-2">
            <RadioGroupItem id={optionId} value={optionValue} />
            <Label htmlFor={optionId} className="cursor-pointer">
              {option.label}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
