// @/components/Form/Input/Manual/AsyncMultiSelectInput/AsyncMultiSelectOptionList.tsx

import { type ReactNode, type UIEvent } from "react";

import { Checkbox } from "@/components/_shadcn/checkbox";
import { CommandItem, CommandList } from "@/components/_shadcn/command";
import {
  includesOptionValue,
  resolveOptionSearchText,
  serializeOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { cn } from "@/lib/cn";

type Props = {
  options: Options[];
  selectedValues: OptionPrimitive[];
  onToggle: (value: OptionPrimitive) => void;
  emptyMessage?: string;
  /** リスト末尾に追加するノード（無限スクロール用 sentinel やローダー） */
  footer?: ReactNode;
  /** CommandList の追加クラス（max-h など上書き） */
  className?: string;
  /** スクロール検知（無限スクロール用） */
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
};

export function AsyncMultiSelectOptionList({
  options,
  selectedValues,
  onToggle,
  emptyMessage = "該当する項目がありません",
  footer,
  className,
  onScroll,
}: Props) {
  const isEmpty = options.length === 0;

  return (
    <CommandList
      className={cn("flex max-h-60 flex-col gap-1 p-1", className)}
      onScroll={onScroll}
    >
      {options.map((option, index) => {
        const serialized = serializeOptionValue(option.value);
        const key = serialized || `option-${index}`;
        const selected = includesOptionValue(selectedValues, option.value);
        const handleToggle = () => onToggle(option.value);
        const searchValue = resolveOptionSearchText(option);

        return (
          <CommandItem
            key={key}
            value={searchValue}
            onSelect={handleToggle}
            className="cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
          >
            <Checkbox
              checked={selected}
              onCheckedChange={handleToggle}
              aria-checked={selected}
            />
            <span className="flex-1 truncate">{option.label}</span>
          </CommandItem>
        );
      })}
      {isEmpty && !footer && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
      {footer}
    </CommandList>
  );
}
