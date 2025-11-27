 "use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const previousValueRef = useRef<File | null | undefined>(value as File | null | undefined);

  useEffect(() => {
    const currentValue = value as File | null | undefined;
    const previous = previousValueRef.current;
    if (previous && !currentValue) {
      setInternalResetSignal((signal) => signal + 1);
    }
    previousValueRef.current = currentValue ?? null;
  }, [value]);

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
