// @/components/Form/Input/Manual/BooleanRadioGroupInput.tsx

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Label } from "@/components/Form/Label";
import { RadioGroup, RadioGroupItem } from "@/components/Primitives/RadioGroup";
import type { VariantProps } from "class-variance-authority";
import { VARIANT_OVERRIDES } from "@/config/ui/variants.config";
import { createOverridableVariants, type CheckControlSize } from "@/lib/variantOverrides";

type BooleanLike = boolean | "true" | "false";

export type BooleanRadioGroupOption = {
  label: string;
  value: BooleanLike;
};

// 見た目の上書き口: src/config/ui/variants.config.ts の booleanRadioGroup({ base, size }、各ラジオの丸)。既定のクラスはここ
const RADIO_ITEM_SIZE = {
  sm: "!size-3 [&_[data-slot=radio-group-indicator]>svg]:!size-1.5",
  md: "!size-4 [&_[data-slot=radio-group-indicator]>svg]:!size-2",
  lg: "!size-5 [&_[data-slot=radio-group-indicator]>svg]:!size-2.5",
} satisfies Record<CheckControlSize, string>;

const radioItemSizeVariants = createOverridableVariants(
  "",
  { variants: { size: RADIO_ITEM_SIZE }, defaultVariants: { size: "md" } },
  VARIANT_OVERRIDES.booleanRadioGroup,
);

type RadioItemSizeProps = VariantProps<typeof radioItemSizeVariants>;

export type BooleanRadioGroupInputProps = {
  /** 現在の値 */
  value?: boolean | null;
  /** フィールド名（id生成に使用） */
  name?: string;
  /** 値が変更されたときのコールバック */
  onChange: (value: boolean) => void;
  options?: BooleanRadioGroupOption[];
  /**
   * ラジオボタンの丸形のサイズ
   */
  size?: RadioItemSizeProps["size"];
} & Omit<ComponentProps<typeof RadioGroup>, "value" | "defaultValue" | "onValueChange" | "name">;

export function BooleanRadioGroupInput({ value, name, onChange, options, size, ...rest }: BooleanRadioGroupInputProps) {
  const radioValue = typeof value === "boolean" ? String(value) : undefined;
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
      onValueChange={(val) => onChange(val === "true")}
      {...rest}
    >
      {normalizedOptions.map((option, index) => {
        const optionValue = String(option.value);
        const optionId = `${name ?? "boolean-radio"}-${optionValue}-${index}`;

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
