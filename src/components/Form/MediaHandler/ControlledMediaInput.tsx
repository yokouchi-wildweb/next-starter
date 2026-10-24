 "use client";

import { useCallback, useState } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";

import { MediaInput, type MediaInputProps } from "@/lib/mediaInputSuite";

type BaseProps = Omit<MediaInputProps, "onFileChange" | "resetSignal">;

export type ControlledMediaInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseProps & {
  field: ControllerRenderProps<TFieldValues, TName>;
  resetKey?: number;
};

export const ControlledMediaInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  resetKey = 0,
  ...mediaInputProps
}: ControlledMediaInputProps<TFieldValues, TName>) => {
  const { value, onChange, onBlur } = field;
  const [internalResetSignal, setInternalResetSignal] = useState(0);
  // 値がファイルから空に変わったら入力をリセットする(前回の render の値と比べて render 中に調整する)
  const currentValue = value as File | null | undefined;
  const [previousValue, setPreviousValue] = useState(currentValue);
  if (previousValue !== currentValue) {
    setPreviousValue(currentValue);
    if (previousValue && !currentValue) {
      setInternalResetSignal((signal) => signal + 1);
    }
  }

  const handleFileChange = useCallback(
    (file: File | null) => {
      onChange(file);
      onBlur();
    },
    [onBlur, onChange],
  );

  const resetSignal = internalResetSignal + resetKey;

  return <MediaInput {...mediaInputProps} onFileChange={handleFileChange} resetSignal={resetSignal} />;
};
