// @/components/Form/Input/Manual/CheckGroupInput.tsx

import { useId, type HTMLAttributes } from "react";

import { type Options } from "@/components/Form/types";
import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { BookmarkTag } from "@/components/Form/Button/BookmarkTag";
import { RoundedButton } from "@/components/Form/Button/RoundedButton";
import { Label } from "@/components/Form/Label";
import { Checkbox } from "@/components/_shadcn/checkbox";
import {
  includesOptionValue,
  serializeOptionValue,
  toggleOptionValue,
} from "@/components/Form/utils";
import { cn } from "@/lib/cn";

export type CheckGroupDisplayType = "standard" | "bookmark" | "rounded" | "classic";
export type CheckGroupOrientation = "horizontal" | "vertical";

type OptionPrimitive = Options["value"];

export type CheckGroupInputProps = {
  /** 現在の値（選択されているオプションの配列） */
  value?: OptionPrimitive[];
  /** 値が変更されたときのコールバック */
  onChange: (value: OptionPrimitive[]) => void;
  /**
   * Options to choose from. Optional so the component can render
   * even when options haven't loaded yet.
   */
  options?: Options[];
  /**
   * 表示タイプ（標準ボタン / ブックマークタグ / 丸形 / クラシック）
   */
  displayType?: CheckGroupDisplayType;
  /** 選択肢の並び方向（デフォルト: classicはvertical、それ以外はhorizontal） */
  orientation?: CheckGroupOrientation;
  /** ボタン表示時に利用するバリアント */
  buttonVariant?: ButtonStyleProps["variant"];
  /** ボタン表示時に利用するサイズ */
  buttonSize?: ButtonStyleProps["size"];
  /** 選択時に利用するバリアント（未指定の場合は buttonVariant を利用） */
  selectedButtonVariant?: ButtonStyleProps["variant"];
  /** 非選択時に利用するバリアント（未指定の場合は buttonVariant を利用） */
  unselectedButtonVariant?: ButtonStyleProps["variant"];
} & HTMLAttributes<HTMLDivElement>;

export function CheckGroupInput({
  value,
  onChange,
  options = [],
  displayType = "standard",
  orientation,
  buttonVariant,
  buttonSize,
  selectedButtonVariant,
  unselectedButtonVariant,
  ...rest
}: CheckGroupInputProps) {
  const groupId = useId();

  const handleToggle = (optionValue: OptionPrimitive) => {
    onChange(toggleOptionValue(value, optionValue));
  };

  // classicのデフォルトはvertical、それ以外はhorizontal
  const resolvedOrientation = orientation ?? (displayType === "classic" ? "vertical" : "horizontal");
  const isVertical = resolvedOrientation === "vertical";
  const classicLayoutClass = isVertical ? "mt-3 flex flex-col gap-4" : "mt-3 flex flex-wrap gap-4";
  const defaultLayoutClass = isVertical ? "flex flex-col gap-2" : "flex flex-wrap gap-2";
  const layoutClass = displayType === "classic" ? classicLayoutClass : defaultLayoutClass;

  const { className, ...restDivProps } = rest;

  if (displayType === "classic") {
    return (
      <div
        className={cn(layoutClass, className)}
        role="group"
        aria-orientation={resolvedOrientation}
        {...restDivProps}
      >
        {options.map((op) => {
          const serialized = serializeOptionValue(op.value);
          const id = `${groupId}-${serialized}`;
          const selected = includesOptionValue(value, op.value);

          return (
            <div key={serialized} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={selected}
                onCheckedChange={() => handleToggle(op.value)}
                aria-checked={selected}
              />
              <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
                {op.label}
              </Label>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(layoutClass, className)}
      role="group"
      aria-orientation={resolvedOrientation}
      {...restDivProps}
    >
      {options.map((op) => {
        const selected = includesOptionValue(value, op.value);
        const resolvedSelectedVariant = selectedButtonVariant ?? buttonVariant ?? "default";
        const resolvedUnselectedVariant = unselectedButtonVariant ?? buttonVariant ?? "outline";
        const serialized = serializeOptionValue(op.value);
        const handleSelect = () => handleToggle(op.value);

        if (displayType === "bookmark") {
          return (
            <BookmarkTag
              key={serialized}
              type="button"
              selected={selected}
              variant={buttonVariant}
              size={buttonSize}
              onClick={handleSelect}
              aria-pressed={selected}
            >
              {op.label}
            </BookmarkTag>
          );
        }

        if (displayType === "standard") {
          const standardButtonBorderClass = selected
            ? "border border-primary"
            : "border border-border";

          return (
            <Button
              key={serialized}
              type="button"
              variant={selected ? resolvedSelectedVariant : resolvedUnselectedVariant}
              size={buttonSize}
              className={standardButtonBorderClass}
              onClick={handleSelect}
              aria-pressed={selected}
            >
              {op.label}
            </Button>
          );
        }

        return (
          <RoundedButton
            key={serialized}
            type="button"
            selected={selected}
            variant={buttonVariant}
            size={buttonSize}
            onClick={handleSelect}
            aria-pressed={selected}
          >
            {op.label}
          </RoundedButton>
        );
      })}
    </div>
  );
}
