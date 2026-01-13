// src/components/Form/Manual/CheckGroupInput.tsx

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

export type CheckGroupDisplayType = "standard" | "bookmark" | "rounded" | "classic";

type OptionPrimitive = Options["value"];

type Props = {
  field: {
    value?: OptionPrimitive[];
    onChange: (value: OptionPrimitive[]) => void;
  };
  /**
   * Options to choose from. Optional so the component can render
   * even when options haven't loaded yet.
   */
  options?: Options[];
  /**
   * 表示タイプ（標準ボタン / ブックマークタグ / 丸形 / クラシック）
   */
  displayType?: CheckGroupDisplayType;
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
  field,
  options = [],
  displayType = "standard",
  buttonVariant,
  buttonSize,
  selectedButtonVariant,
  unselectedButtonVariant,
  ...rest
}: Props) {
  const groupId = useId();

  const handleToggle = (value: OptionPrimitive) => {
    field.onChange(toggleOptionValue(field.value, value));
  };

  if (displayType === "classic") {
    return (
      <div className="flex flex-col gap-2" {...rest}>
        {options.map((op) => {
          const serialized = serializeOptionValue(op.value);
          const id = `${groupId}-${serialized}`;
          const selected = includesOptionValue(field.value, op.value);

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
    <div className="flex flex-wrap items-start gap-2" {...rest}>
      {options.map((op) => {
        const selected = includesOptionValue(field.value, op.value);
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
