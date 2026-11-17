// src/components/Form/Input/Manual/Select.tsx

import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Primitives/Select";
import type { FormControlA11yProps } from "@/components/Form/Field/types";
import { type Options } from "@/components/Form/types";
import { cn } from "@/lib/cn";
import { zLayerClass } from "@/lib/zLayer";

import { inputVariants, type InputSize } from "./Input";

type OptionPrimitive = Options["value"];

export type SelectInputProps = {
  /** 現在の値 */
  value?: OptionPrimitive | "" | null;
  /** 値が変更されたときのコールバック */
  onChange: (value: OptionPrimitive | "" | null) => void;
  /** フォーカスが外れたときのコールバック（ドロップダウンが閉じた時に発火） */
  onBlur?: () => void;
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
   * トリガーの高さの段(入力欄・ボタンの size と同じ名前・同じ高さ、--control-h-<size>)。
   * 一覧のフィルタ・並び替えなどツールバー向けのコンパクトな高さは xs(32px)。
   * @default "md"
   */
  size?: InputSize;
  /**
   * SelectTrigger に適用するクラス名。
   */
  className?: string;
  /**
   * SelectContent に適用するクラス名（z-index調整などに使用）。
   * モーダル内で使用する場合は zLayerClass("surface-ui")(@/lib/zLayer)などを指定。
   */
  contentClassName?: string;
  /** 無効化 */
  disabled?: boolean;
} & FormControlA11yProps; // id・aria-* はトリガー要素へ(外部 Label の htmlFor・枠の説明文 / エラー用)

const CLEAR_VALUE = "__EMPTY__";

const serializeValue = (value: OptionPrimitive | "" | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
};

export function SelectInput({
  value,
  onChange,
  onBlur,
  options = [],
  placeholder,
  includeNullOption = false,
  nullOptionLabel = "未選択（null）",
  showPlaceholderOption = true,
  size = "md",
  id,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
  className,
  contentClassName,
  disabled,
  ...rest
}: SelectInputProps) {
  const handleChange = (selectedValue: string) => {
    if (selectedValue === CLEAR_VALUE) {
      onChange(includeNullOption ? null : "");
      return;
    }
    const matchedOption = options.find((op) => serializeValue(op.value) === selectedValue);
    onChange((matchedOption?.value ?? selectedValue) as OptionPrimitive);
  };

  const hasValue = !(value === "" || value === null || typeof value === "undefined");
  // showPlaceholderOption: false の場合、空値時は空文字列を使用して Radix の placeholder 機能を利用
  const currentValue = hasValue
    ? serializeValue(value as OptionPrimitive)
    : showPlaceholderOption
      ? CLEAR_VALUE
      : "";

  const handleOpenChange = (open: boolean) => {
    // ドロップダウンが閉じた時にonBlurを発火
    if (!open) {
      onBlur?.();
    }
  };

  return (
    <ShadcnSelect
      onValueChange={handleChange}
      onOpenChange={handleOpenChange}
      value={currentValue}
      disabled={disabled}
      {...rest}
    >
      <SelectTrigger
        id={id}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid}
        size="none"
        className={inputVariants({ size, className })}
      >
        <SelectValue placeholder={placeholder ?? "選択してください"} />
      </SelectTrigger>
      <SelectContent className={cn(zLayerClass("surface-ui"), contentClassName)}>
        {includeNullOption ? (
          <SelectItem value={CLEAR_VALUE}>{nullOptionLabel}</SelectItem>
        ) : showPlaceholderOption ? (
          <SelectItem value={CLEAR_VALUE}>{placeholder ?? "選択してください"}</SelectItem>
        ) : null}
        {options.map((op, index) => {
          const serialized = serializeValue(op.value);
          const key = serialized || `option-${index}`;
          return (
            <SelectItem key={key} value={serialized} disabled={op.disabled}>
              {op.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </ShadcnSelect>
  );
}
