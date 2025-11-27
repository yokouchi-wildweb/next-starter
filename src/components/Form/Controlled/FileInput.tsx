"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";

import {
  FileInput as ManualFileInput,
  type FileInputProps as ManualFileInputProps,
} from "@/components/Form/Manual";

export type FileInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ManualFileInputProps, "resetKey" | "onChange"> & {
  field: ControllerRenderProps<TFieldValues, TName>;
  resetKey?: number;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const FileInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, resetKey = 0, onChange, ...rest }: FileInputProps<TFieldValues, TName>) => {
  const [internalResetKey, setInternalResetKey] = useState(0);
  const previousValueRef = useRef<File | null | undefined>(field.value as File | null | undefined);

  useEffect(() => {
    const currentValue = field.value as File | null | undefined;
    const previousValue = previousValueRef.current;
    if (previousValue && !currentValue) {
      setInternalResetKey((key) => key + 1);
    }
    previousValueRef.current = currentValue ?? null;
  }, [field.value]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      const file = event.target.files?.[0] ?? null;
      field.onChange(file);
      field.onBlur();
    },
    [field, onChange],
  );

  return (
    <ManualFileInput
      {...rest}
      name={field.name}
      resetKey={resetKey + internalResetKey}
      ref={field.ref}
      onBlur={field.onBlur}
      onChange={handleChange}
    />
  );
};
