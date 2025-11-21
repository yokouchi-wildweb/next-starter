// src/components/Form/Manual/Select.tsx

import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_shadcn/select";
import { Options } from "@/types/form";

type OptionPrimitive = Options[number]["value"];

type Props = {
  field: {
    value?: OptionPrimitive | "" | null;
    onChange: (value: OptionPrimitive | "") => void;
  };
  /**
   * Selectable options. If omitted, an empty list is used so the component can
   * safely render before options load.
   */
  options?: Options[];
  placeholder?: string;
};

const CLEAR_VALUE = "__EMPTY__";

const serializeValue = (value: OptionPrimitive | "" | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
};

export function SelectInput({ field, options = [], placeholder, ...rest }: Props) {
  const handleChange = (value: string) => {
    if (value === CLEAR_VALUE) {
      field.onChange("");
      return;
    }
    const matchedOption = options.find((op) => serializeValue(op.value) === value);
    field.onChange((matchedOption?.value ?? value) as OptionPrimitive);
  };

  const hasValue = !(field.value === "" || field.value === null || typeof field.value === "undefined");
  const currentValue = hasValue ? serializeValue(field.value as OptionPrimitive) : CLEAR_VALUE;

  return (
    <ShadcnSelect
      onValueChange={handleChange}
      value={currentValue}
      defaultValue={currentValue}
      {...rest}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "選択してください"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CLEAR_VALUE}>{placeholder ?? "選択してください"}</SelectItem>
        {options.map((op, index) => {
          const serialized = serializeValue(op.value);
          const key = serialized || `option-${index}`;
          return (
            <SelectItem key={key} value={serialized}>
              {op.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </ShadcnSelect>
  );
}
