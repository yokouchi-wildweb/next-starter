// src/components/Form/manual/RadioGroupInput.tsx

import type { ComponentProps } from "react";

import { Button, type ButtonStyleProps } from "@/components/Form/button/Button";
import { BookmarkTag } from "@/components/Form/button/BookmarkTag";
import { RoundedButton } from "@/components/Form/button/RoundedButton";
import { Label } from "@/components/Form/Label";
import { RadioGroup, RadioGroupItem } from "@/components/Shadcn/radio-group";
import { cn } from "@/lib/cn";
import { Options } from "@/types/form";

export type RadioGroupDisplayType = "radio" | "standard" | "bookmark" | "rounded";

type Props = {
  field: {
    value?: string;
    onChange: (value: string) => void;
  };
  /**
   * Options to choose from. Optional so the component can render
   * even when options haven't loaded yet.
   */
  options?: Options[];
  /** 表示タイプ（従来型 / 標準ボタン / ブックマークタグ / 丸形） */
  displayType?: RadioGroupDisplayType;
  /** ボタン表示時に利用するバリアント */
  buttonVariant?: ButtonStyleProps["variant"];
  /** ボタン表示時に利用するサイズ */
  buttonSize?: ButtonStyleProps["size"];
  /** 選択時に利用するバリアント（未指定の場合は buttonVariant を利用） */
  selectedButtonVariant?: ButtonStyleProps["variant"];
  /** 非選択時に利用するバリアント（未指定の場合は buttonVariant を利用） */
  unselectedButtonVariant?: ButtonStyleProps["variant"];
} & Omit<ComponentProps<typeof RadioGroup>, "value" | "defaultValue" | "onValueChange">;

export function RadioGroupInput({
  field,
  options = [],
  displayType = "radio",
  buttonVariant,
  buttonSize,
  selectedButtonVariant,
  unselectedButtonVariant,
  ...rest
}: Props) {
  if (displayType === "radio") {
    return (
      <RadioGroup onValueChange={field.onChange} value={field.value} defaultValue={field.value} {...rest}>
        {options.map((op, index) => {
          const optionId = `${rest.name ?? "radio"}-${op.value}-${index}`;

          return (
            <div key={optionId} className="flex items-center gap-2">
              <RadioGroupItem id={optionId} value={op.value} />
              <Label htmlFor={optionId} className="cursor-pointer">
                {op.label}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  const { className, orientation, ...restDivProps } = rest;

  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="radiogroup"
      aria-orientation={orientation}
      {...(restDivProps as ComponentProps<"div">)}
    >
      {options.map((op) => {
        const selected = field.value === op.value;
        const resolvedSelectedVariant = selectedButtonVariant ?? buttonVariant ?? "default";
        const resolvedUnselectedVariant = unselectedButtonVariant ?? buttonVariant ?? "outline";

        if (displayType === "bookmark") {
          return (
            <BookmarkTag
              key={op.value}
              type="button"
              selected={selected}
              variant={buttonVariant}
              size={buttonSize}
              onClick={() => field.onChange(op.value)}
              role="radio"
              aria-checked={selected}
            >
              {op.label}
            </BookmarkTag>
          );
        }

        if (displayType === "rounded") {
          return (
            <RoundedButton
              key={op.value}
              type="button"
              selected={selected}
              variant={buttonVariant}
              size={buttonSize}
              onClick={() => field.onChange(op.value)}
              role="radio"
              aria-checked={selected}
            >
              {op.label}
            </RoundedButton>
          );
        }

        return (
          <Button
            key={op.value}
            type="button"
            variant={selected ? resolvedSelectedVariant : resolvedUnselectedVariant}
            size={buttonSize}
            onClick={() => field.onChange(op.value)}
            role="radio"
            aria-checked={selected}
          >
            {op.label}
          </Button>
        );
      })}
    </div>
  );
}
