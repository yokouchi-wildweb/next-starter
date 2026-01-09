// src/components/Form/Manual/Select.tsx

import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_shadcn/select";
import { type Options } from "@/types/form";

type OptionPrimitive = Options["value"];

type Props = {
  field: {
    value?: OptionPrimitive | "" | null;
    onChange: (value: OptionPrimitive | "" | null) => void;
  };
  /**
   * Selectable options. If omitted, an empty list is used so the component can
   * safely render before options load.
   */
  options?: Options[];
  placeholder?: string;
  includeNullOption?: boolean;
  nullOptionLabel?: string;
  /**
   * ドロップダウン内にプレースホルダー項目（「選択してください」）を表示するか。
   * false の場合、ドロップダウンには実際の選択肢のみが表示される。
   * トリガーの placeholder テキストは引き続き表示される。
   * @default true
   */
  showPlaceholderOption?: boolean;
  /**
   * SelectContent に適用するクラス名（z-index調整などに使用）。
   * モーダル内で使用する場合は "surface-ui-layer" などを指定。
   */
  contentClassName?: string;
};

const CLEAR_VALUE = "__EMPTY__";

const serializeValue = (value: OptionPrimitive | "" | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
};

export function SelectInput({
  field,
  options = [],
  placeholder,
  includeNullOption = false,
  nullOptionLabel = "未選択（null）",
  showPlaceholderOption = true,
  contentClassName,
  ...rest
}: Props) {
  const handleChange = (value: string) => {
    if (value === CLEAR_VALUE) {
      field.onChange(includeNullOption ? null : "");
      return;
    }
    const matchedOption = options.find((op) => serializeValue(op.value) === value);
    field.onChange((matchedOption?.value ?? value) as OptionPrimitive);
  };

  const hasValue = !(field.value === "" || field.value === null || typeof field.value === "undefined");
  // showPlaceholderOption: false の場合、空値時は空文字列を使用して Radix の placeholder 機能を利用
  const currentValue = hasValue
    ? serializeValue(field.value as OptionPrimitive)
    : showPlaceholderOption
      ? CLEAR_VALUE
      : "";

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
      <SelectContent className={contentClassName}>
        {includeNullOption ? (
          <SelectItem value={CLEAR_VALUE}>{nullOptionLabel}</SelectItem>
        ) : showPlaceholderOption ? (
          <SelectItem value={CLEAR_VALUE}>{placeholder ?? "選択してください"}</SelectItem>
        ) : null}
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
