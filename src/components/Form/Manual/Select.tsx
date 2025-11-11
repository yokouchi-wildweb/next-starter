// src/components/Form/Manual/Select.tsx

import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Shadcn/select";
import { Options } from "@/types/form";

type Props = {
  field: {
    value?: string;
    onChange: (value: string) => void;
  };
  /**
   * Selectable options. If omitted, an empty list is used so the component can
   * safely render before options load.
   */
  options?: Options[];
  placeholder?: string;
};

const CLEAR_VALUE = "__EMPTY__";

export function SelectInput({ field, options = [], placeholder, ...rest }: Props) {
  const handleChange = (value: string) => {
    field.onChange(value === CLEAR_VALUE ? "" : value);
  };

  const rawValue = field.value ?? "";
  const currentValue = rawValue === "" ? CLEAR_VALUE : rawValue;

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
        {options.map((op) => (
          <SelectItem key={op.value} value={op.value}>
            {op.label}
          </SelectItem>
        ))}
      </SelectContent>
    </ShadcnSelect>
  );
}
