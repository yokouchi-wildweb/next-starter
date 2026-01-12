// src/components/Form/Manual/MultiSelectInput/MultiSelectOptionList.tsx

import { Checkbox } from "@/components/_shadcn/checkbox";
import { CommandEmpty, CommandItem, CommandList } from "@/components/_shadcn/command";
import {
  includesOptionValue,
  resolveOptionSearchText,
  serializeOptionValue,
  type OptionPrimitive,
} from "@/components/Form/utils";
import { type Options } from "@/components/Form/types";

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
    <CommandList className="max-h-60 space-y-1 p-1">
      <CommandEmpty>{emptyMessage ?? "該当する項目がありません"}</CommandEmpty>
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
            <Checkbox checked={selected} onCheckedChange={handleToggle} aria-checked={selected} />
            <span className="truncate">{option.label}</span>
          </CommandItem>
        );
      })}
    </CommandList>
  );
}
