// src/components/Form/Manual/CheckGroupInput.tsx

import { useId, type HTMLAttributes } from "react";

import { Options } from "@/types/form";
import { Button, type ButtonStyleProps } from "@/components/Form/Button/Button";
import { BookmarkTag } from "@/components/Form/Button/BookmarkTag";
import { RoundedButton } from "@/components/Form/Button/RoundedButton";
import { Label } from "@/components/Form/Label";
import { Checkbox } from "@/components/Shadcn/checkbox";

export type CheckGroupDisplayType = "standard" | "bookmark" | "rounded" | "checkbox";

type Props = {
  field: {
    value?: string[];
    onChange: (value: string[]) => void;
  };
  /**
   * Options to choose from. Optional so the component can render
   * even when options haven't loaded yet.
   */
  options?: Options[];
  /**
   * 表示タイプ（標準ボタン / ブックマークタグ / 丸形 / 従来型チェックボックス）
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

function toggleValue(currentValues: string[] | undefined, nextValue: string) {
  const values = currentValues ?? [];
  if (values.includes(nextValue)) {
    return values.filter((value) => value !== nextValue);
  }

  return [...values, nextValue];
}

export function CheckGroupInput({
  field,
  options = [],
  displayType = "rounded",
  buttonVariant,
  buttonSize,
  selectedButtonVariant,
  unselectedButtonVariant,
  ...rest
}: Props) {
  const groupId = useId();

  const handleToggle = (value: string) => {
    field.onChange(toggleValue(field.value, value));
  };

  if (displayType === "checkbox") {
    return (
      <div className="flex flex-col gap-2" {...rest}>
        {options.map((op) => {
          const id = `${groupId}-${op.value}`;
          const selected = field.value?.includes(op.value) ?? false;

          return (
            <div key={op.value} className="flex items-center gap-2">
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
        const selected = field.value?.includes(op.value) ?? false;
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
              onClick={() => handleToggle(op.value)}
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
              key={op.value}
              type="button"
              variant={selected ? resolvedSelectedVariant : resolvedUnselectedVariant}
              size={buttonSize}
              className={standardButtonBorderClass}
              onClick={() => handleToggle(op.value)}
              aria-pressed={selected}
            >
              {op.label}
            </Button>
          );
        }

        return (
          <RoundedButton
            key={op.value}
            type="button"
            selected={selected}
            variant={buttonVariant}
            size={buttonSize}
            onClick={() => handleToggle(op.value)}
            aria-pressed={selected}
          >
            {op.label}
          </RoundedButton>
        );
      })}
    </div>
  );
}
