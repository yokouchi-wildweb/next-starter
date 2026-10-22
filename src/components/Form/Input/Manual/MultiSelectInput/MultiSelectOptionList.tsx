// @/components/Form/Input/Manual/MultiSelectInput/MultiSelectOptionList.tsx

import { Checkbox } from "@/components/_shadcn/checkbox";
import { CommandEmpty, CommandItem, CommandList } from "@/components/_shadcn/command";
import {
  includesOptionValue,
  resolveOptionItemIdentity,
  resolveOptionSearchText,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";
import { cn } from "@/lib/cn";

type Props = {
  options: Options[];
  selectedValues: OptionPrimitive[];
  onToggle: (value: OptionPrimitive) => void;
  emptyMessage?: string;
};

export function MultiSelectOptionList({
  options,
  selectedValues,
  onToggle,
  emptyMessage,
}: Props) {
  return (
    <CommandList className="max-h-60 flex flex-col gap-1 p-1">
      <CommandEmpty>{emptyMessage ?? "該当する項目がありません"}</CommandEmpty>
      {options.map((option, index) => {
        const identity = resolveOptionItemIdentity(option, index);
        const selected = includesOptionValue(selectedValues, option.value);
        // disabled は表示のみ。選択済みでもこの行からは解除できない
        const disabled = option.disabled === true;
        const handleToggle = () => {
          if (disabled) return;
          onToggle(option.value);
        };

        return (
          <CommandItem
            key={identity}
            value={identity}
            keywords={[resolveOptionSearchText(option)]}
            disabled={disabled}
            onSelect={handleToggle}
            className={cn(
              "cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
              disabled && "cursor-not-allowed",
            )}
          >
            <Checkbox
              checked={selected}
              disabled={disabled}
              onCheckedChange={handleToggle}
              aria-checked={selected}
            />
            <span className="truncate">{option.label}</span>
          </CommandItem>
        );
      })}
    </CommandList>
  );
}
