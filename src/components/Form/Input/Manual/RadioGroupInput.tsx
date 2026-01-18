// src/components/Form/Manual/RadioGroupInput.tsx

import type { ComponentProps } from "react";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { BookmarkTag } from "@/components/Form/Button/BookmarkTag";
import { RoundedButton } from "@/components/Form/Button/RoundedButton";
import { Label } from "@/components/Form/Label";
import { RadioGroup, RadioGroupItem } from "@/components/_shadcn/radio-group";
import { cn } from "@/lib/cn";
import { type Options } from "@/components/Form/types";

export type RadioGroupDisplayType = "classic" | "standard" | "bookmark" | "rounded";
export type RadioGroupOrientation = "horizontal" | "vertical";

type OptionPrimitive = Options["value"];

export type RadioGroupInputProps = {
  /** 現在の値 */
  value?: OptionPrimitive | null;
  /** 値が変更されたときのコールバック */
  onChange: (value: OptionPrimitive) => void;
  /**
   * Options to choose from. Optional so the component can render
   * even when options haven't loaded yet.
   */
  options?: Options[];
  /** 表示タイプ（クラシック / 標準ボタン / ブックマークタグ / 丸形） */
  displayType?: RadioGroupDisplayType;
  /** 選択肢の並び方向（デフォルト: horizontal） */
  orientation?: RadioGroupOrientation;
  /** ボタン表示時に利用するバリアント */
  buttonVariant?: ButtonStyleProps["variant"];
  /** ボタン表示時に利用するサイズ */
  buttonSize?: ButtonStyleProps["size"];
  /** 選択時に利用するバリアント（未指定の場合は buttonVariant を利用） */
  selectedButtonVariant?: ButtonStyleProps["variant"];
  /** 非選択時に利用するバリアント（未指定の場合は buttonVariant を利用） */
  unselectedButtonVariant?: ButtonStyleProps["variant"];
} & Omit<ComponentProps<typeof RadioGroup>, "value" | "defaultValue" | "onValueChange" | "orientation">;

export function RadioGroupInput({
  value,
  onChange,
  options = [],
  displayType = "standard",
  orientation = "horizontal",
  buttonVariant,
  buttonSize,
  selectedButtonVariant,
  unselectedButtonVariant,
  ...rest
}: RadioGroupInputProps) {
  const serializedValue =
    value === null || typeof value === "undefined" ? undefined : String(value);

  const mapOptionValue = (value: OptionPrimitive) => String(value);

  const resolveOriginalValue = (value: string): OptionPrimitive | string => {
    const matched = options.find((op) => mapOptionValue(op.value) === value);
    return (matched?.value ?? value) as OptionPrimitive;
  };

  const isVertical = orientation === "vertical";
  const layoutClass = isVertical ? "flex flex-col gap-2" : "flex flex-wrap gap-2";

  if (displayType === "classic") {
    return (
      <RadioGroup
        onValueChange={(value) => onChange(resolveOriginalValue(value) as OptionPrimitive)}
        value={serializedValue}
        defaultValue={serializedValue}
        className={cn(layoutClass, rest.className)}
        aria-orientation={orientation}
      >
        {options.map((op, index) => {
          const serialized = mapOptionValue(op.value);
          const optionId = `${rest.name ?? "radio"}-${serialized}-${index}`;

          return (
            <div key={optionId} className="flex items-center gap-2">
              <RadioGroupItem id={optionId} value={serialized} />
              <Label htmlFor={optionId} className="cursor-pointer">
                {op.label}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  const { className, ...restDivProps } = rest;

  return (
    <div
      className={cn(layoutClass, className)}
      role="radiogroup"
      aria-orientation={orientation}
      {...(restDivProps as ComponentProps<"div">)}
    >
      {options.map((op) => {
        const optionSerialized = mapOptionValue(op.value);
        const selected = serializedValue === optionSerialized;
        const resolvedSelectedVariant = selectedButtonVariant ?? buttonVariant ?? "default";
        const resolvedUnselectedVariant = unselectedButtonVariant ?? buttonVariant ?? "outline";

        const handleSelect = () => onChange(op.value);

        const key = optionSerialized || String(op.label ?? op.value);

        if (displayType === "bookmark") {
          return (
            <BookmarkTag
              key={key}
              type="button"
              selected={selected}
              variant={buttonVariant}
              size={buttonSize}
              onClick={handleSelect}
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
              key={key}
              type="button"
              selected={selected}
              variant={buttonVariant}
              size={buttonSize}
              onClick={handleSelect}
              role="radio"
              aria-checked={selected}
            >
              {op.label}
            </RoundedButton>
          );
        }

        if (displayType === "standard") {
          const standardButtonBorderClass = selected ? "border border-primary" : "border border-border";

          return (
            <Button
              key={key}
              type="button"
              variant={selected ? resolvedSelectedVariant : resolvedUnselectedVariant}
              size={buttonSize}
              className={standardButtonBorderClass}
              onClick={handleSelect}
              role="radio"
              aria-checked={selected}
            >
              {op.label}
            </Button>
          );
        }

        return (
          <Button
            key={key}
            type="button"
            variant={selected ? resolvedSelectedVariant : resolvedUnselectedVariant}
            size={buttonSize}
            onClick={handleSelect}
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
