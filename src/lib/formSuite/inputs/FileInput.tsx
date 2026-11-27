"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, type ChangeEvent } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";

import { FileInput as ManualFileInput, type FileInputProps as ManualFileInputProps } from "@/components/Input/FileInput";

export type ControlledFileInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ManualFileInputProps, "resetKey" | "onChange"> & {
  field: ControllerRenderProps<TFieldValues, TName>;
  resetKey?: number;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  initialUrl?: string;
  onFileSelect?: (file: File | null) => void;
  onRemove?: () => void;
  selectedFileName?: string;
};

export const ControlledFileInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  resetKey = 0,
  onChange,
  initialUrl,
  onFileSelect,
  onRemove,
  selectedFileName,
  ...rest
}: ControlledFileInputProps<TFieldValues, TName>) => {
  const [internalResetKey, setInternalResetKey] = useState(0);
  const previousValueRef = useRef<File | null | undefined>(field.value as File | null | undefined);

  useEffect(() => {
    const currentValue = field.value as File | null | undefined;
    const previousValue = previousValueRef.current;
    if (previousValue && !currentValue) {
      queueMicrotask(() => {
        setInternalResetKey((key) => key + 1);
      });
    }
    previousValueRef.current = currentValue ?? null;
  }, [field.value]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      const file = event.target.files?.[0] ?? null;
      field.onChange(file);
      field.onBlur();
      onFileSelect?.(file);
    },
    [field, onChange, onFileSelect],
  );

  // initialUrl を field に入れるのは initialUrl が替わった時だけ(D153): field は親の描き直しで作り直されるので、
  // field を依存に入れると走り直して、選んだファイルを initialUrl で上書きした。field.onChange は最新を読む
  const applyInitialUrl = useEffectEvent((url: string) => {
    field.onChange(url);
    previousValueRef.current = null;
  });
  useEffect(() => {
    if (initialUrl) applyInitialUrl(initialUrl);
  }, [initialUrl]);

  const derivedName =
    typeof field.value === "object" &&
    field.value !== null &&
    "name" in (field.value as File | { name?: string }) &&
    typeof (field.value as File | { name?: string }).name === "string"
      ? (field.value as File | { name?: string }).name
      : undefined;

  return (
    <ManualFileInput
      {...rest}
      selectedFileName={selectedFileName ?? derivedName ?? undefined}
      resetKey={resetKey + internalResetKey}
      onChange={handleChange}
      onRemove={onRemove}
    />
  );
};
