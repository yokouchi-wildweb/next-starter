// @/components/Form/Input/Manual/RadioGroupInput.tsx

import type { ComponentProps } from "react";

import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { BookmarkTag } from "@/components/Form/Button/BookmarkTag";
import { RoundedButton } from "@/components/Form/Button/RoundedButton";
import { Label } from "@/components/Form/Label";
import { RadioGroup, RadioGroupItem } from "@/components/Primitives/RadioGroup";
import { cn } from "@/lib/cn";
import { type Options } from "@/components/Form/types";

export type RadioGroupDisplayType = "classic" | "standard" | "bookmark" | "rounded" | "segmented";

/**
 * segmented = 選択肢を 1 つの溝に横並びで収め、選んだものだけ白い札が浮く切り替え(2 つ以上いくつでも)。
 * 高さは h-9(Button の sm と同じ)。buttonSize / buttonVariant 系は使わない
 */
const SEGMENTED_TRACK_CLASS = "inline-flex h-9 max-w-full items-center gap-1 rounded-lg bg-muted p-1";
const SEGMENTED_TRACK_VERTICAL_CLASS = "inline-flex flex-col items-stretch gap-1 rounded-lg bg-muted p-1";
const SEGMENTED_ITEM_CLASS =
  "inline-flex h-7 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-[color,background-color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
const SEGMENTED_SELECTED_CLASS = "bg-background text-foreground shadow-sm";
const SEGMENTED_UNSELECTED_CLASS = "text-muted-foreground hover:text-foreground";
export type RadioGroupOrientation = "horizontal" | "vertical";

type OptionPrimitive = Options["value"];

export type RadioGroupInputProps = {
  /** 現在の値 */
  value?: OptionPrimitive | null;
  /** 値が変更されたときのコールバック */
  onChange: (value: OptionPrimitive) => void;
  /** フォーカスが外れたときのコールバック（値変更後に発火） */
  onBlur?: () => void;
  /**
   * Options to choose from. Optional so the component can render
   * even when options haven't loaded yet.
   */
  options?: Options[];
  /** 表示タイプ（クラシック / 標準ボタン / ブックマークタグ / 丸形 / セグメント） */
  displayType?: RadioGroupDisplayType;
  /** 選択肢の並び方向（デフォルト: classicはvertical、それ以外はhorizontal） */
  orientation?: RadioGroupOrientation;
  /** ボタン表示時に利用するバリアント */
  buttonVariant?: ButtonStyleProps["variant"];
  /** ボタン表示時に利用するサイズ */
  buttonSize?: ButtonStyleProps["size"];
  /** 選択時に利用するバリアント（未指定の場合は buttonVariant を利用） */
  selectedButtonVariant?: ButtonStyleProps["variant"];
  /** 非選択時に利用するバリアント（未指定の場合は buttonVariant を利用） */
  unselectedButtonVariant?: ButtonStyleProps["variant"];
  /** 無効化 */
  disabled?: boolean;
} & Omit<ComponentProps<typeof RadioGroup>, "value" | "defaultValue" | "onValueChange" | "orientation" | "disabled">;

export function RadioGroupInput({
  value,
  onChange,
  onBlur,
  options = [],
  displayType = "standard",
  orientation,
  buttonVariant,
  buttonSize,
  selectedButtonVariant,
  unselectedButtonVariant,
  disabled,
  ...rest
}: RadioGroupInputProps) {
  // 値変更後にonBlurを発火するラップ関数
  const handleChange = (newValue: OptionPrimitive) => {
    onChange(newValue);
    onBlur?.();
  };
  const serializedValue =
    value === null || typeof value === "undefined" ? undefined : String(value);

  const mapOptionValue = (value: OptionPrimitive) => String(value);

  const resolveOriginalValue = (value: string): OptionPrimitive | string => {
    const matched = options.find((op) => mapOptionValue(op.value) === value);
    return (matched?.value ?? value) as OptionPrimitive;
  };

  // classicのデフォルトはvertical、それ以外はhorizontal
  const resolvedOrientation = orientation ?? (displayType === "classic" ? "vertical" : "horizontal");
  const isVertical = resolvedOrientation === "vertical";
  const classicLayoutClass = isVertical ? "mt-3 flex flex-col gap-4" : "mt-3 flex flex-wrap gap-4";
  const defaultLayoutClass = isVertical ? "flex flex-col gap-2" : "flex flex-wrap gap-2";
  const segmentedLayoutClass = isVertical ? SEGMENTED_TRACK_VERTICAL_CLASS : SEGMENTED_TRACK_CLASS;
  const layoutClass =
    displayType === "classic" ? classicLayoutClass : displayType === "segmented" ? segmentedLayoutClass : defaultLayoutClass;

  if (displayType === "classic") {
    return (
      <RadioGroup
        onValueChange={(value) => handleChange(resolveOriginalValue(value) as OptionPrimitive)}
        value={serializedValue}
        defaultValue={serializedValue}
        disabled={disabled}
        className={cn(layoutClass, rest.className)}
        aria-orientation={resolvedOrientation}
      >
        {options.map((op, index) => {
          const serialized = mapOptionValue(op.value);
          const optionId = `${rest.name ?? "radio"}-${serialized}-${index}`;

          return (
            <div key={optionId} className="flex items-center gap-2">
              <RadioGroupItem
                id={optionId}
                value={serialized}
                disabled={op.disabled}
                className="border-muted-foreground"
              />
              <Label
                htmlFor={optionId}
                className={cn(
                  "text-sm font-normal cursor-pointer",
                  (disabled || op.disabled) && "cursor-not-allowed opacity-50"
                )}
              >
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
      className={cn(layoutClass, className, disabled && "opacity-70")}
      role="radiogroup"
      aria-orientation={resolvedOrientation}
      aria-disabled={disabled}
      {...(restDivProps as ComponentProps<"div">)}
    >
      {options.map((op) => {
        const optionSerialized = mapOptionValue(op.value);
        const selected = serializedValue === optionSerialized;
        const resolvedSelectedVariant = selectedButtonVariant ?? buttonVariant ?? "default";
        const resolvedUnselectedVariant = unselectedButtonVariant ?? buttonVariant ?? "outline";

        // option.disabled は表示のみ。選択済みでもそのまま残る
        const optionDisabled = disabled || op.disabled === true;
        const handleSelect = () => {
          if (optionDisabled) return;
          handleChange(op.value);
        };

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
              disabled={optionDisabled}
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
              disabled={optionDisabled}
              role="radio"
              aria-checked={selected}
            >
              {op.label}
            </RoundedButton>
          );
        }

        if (displayType === "segmented") {
          return (
            <Button
              key={key}
              type="button"
              variant="none"
              size="none"
              className={cn(SEGMENTED_ITEM_CLASS, selected ? SEGMENTED_SELECTED_CLASS : SEGMENTED_UNSELECTED_CLASS)}
              onClick={handleSelect}
              disabled={optionDisabled}
              role="radio"
              aria-checked={selected}
              data-state={selected ? "on" : "off"}
            >
              {op.label}
            </Button>
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
              disabled={optionDisabled}
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
            disabled={optionDisabled}
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
