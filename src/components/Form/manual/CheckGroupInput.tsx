// src/components/Form/manual/CheckGroupInput.tsx

import { useId, type HTMLAttributes } from "react";

import { Options } from "@/types/form";
import { Button } from "@/components/Form/button/Button";
import { BookmarkTag } from "@/components/Form/button/BookmarkTag";
import { RoundedButton } from "@/components/Form/button/RoundedButton";
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
              <Label htmlFor={id} className="text-sm font-normal">
                {op.label}
              </Label>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" {...rest}>
      {options.map((op) => {
        const selected = field.value?.includes(op.value) ?? false;

        if (displayType === "bookmark") {
          return (
            <BookmarkTag key={op.value} type="button" selected={selected} onClick={() => handleToggle(op.value)}>
              {op.label}
            </BookmarkTag>
          );
        }

        if (displayType === "standard") {
          return (
            <Button
              key={op.value}
              type="button"
              variant={selected ? "default" : "outline"}
              onClick={() => handleToggle(op.value)}
            >
              {op.label}
            </Button>
          );
        }

        return (
          <RoundedButton key={op.value} type="button" selected={selected} onClick={() => handleToggle(op.value)}>
            {op.label}
          </RoundedButton>
        );
      })}
    </div>
  );
}
