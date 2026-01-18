// src/components/Form/Manual/BooleanRadioGroupInput.tsx

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Label } from "@/components/Form/Label";
import { RadioGroup, RadioGroupItem } from "@/components/_shadcn/radio-group";
import { cva, type VariantProps } from "class-variance-authority";

type BooleanLike = boolean | "true" | "false";

export type BooleanRadioGroupOption = {
  label: string;
  value: BooleanLike;
};

const radioItemSizeVariants = cva("", {
  variants: {
    size: {
      sm: "!size-3 [&_[data-slot=radio-group-indicator]>svg]:!size-1.5",
      md: "!size-4 [&_[data-slot=radio-group-indicator]>svg]:!size-2",
      lg: "!size-5 [&_[data-slot=radio-group-indicator]>svg]:!size-2.5",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type RadioItemSizeProps = VariantProps<typeof radioItemSizeVariants>;

type Props = {
  field: {
    value?: boolean | null;
    name?: string;
    onChange: (value: boolean) => void;
  };
  options?: BooleanRadioGroupOption[];
  /**
   * ラジオボタンの丸形のサイズ
   */
  size?: RadioItemSizeProps["size"];
} & Omit<ComponentProps<typeof RadioGroup>, "value" | "defaultValue" | "onValueChange">;

export function BooleanRadioGroupInput({ field, options, size, ...rest }: Props) {
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
            <RadioGroupItem
              id={optionId}
              value={optionValue}
              className={cn(radioItemSizeVariants({ size }))}
            />
            <Label htmlFor={optionId} className="cursor-pointer">
              {option.label}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
