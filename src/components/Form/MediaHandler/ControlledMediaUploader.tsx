 "use client";

import { useCallback } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";

import { MediaUploader, type MediaUploaderProps } from "@/lib/mediaInputSuite";

type BaseProps = Omit<MediaUploaderProps, "initialUrl" | "onUrlChange">;

export type ControlledMediaUploaderProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseProps & {
  field: ControllerRenderProps<TFieldValues, TName>;
  defaultUrl?: string | null;
  onUrlChange?: (url: string | null) => void;
};

export const ControlledMediaUploader = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  defaultUrl = null,
  onUrlChange,
  ...uploaderProps
}: ControlledMediaUploaderProps<TFieldValues, TName>) => {
  const fieldValue = (field.value as string | null | undefined) ?? null;
  const resolvedInitialUrl = fieldValue ?? defaultUrl ?? null;

  const handleUrlChange = useCallback(
    (url: string | null) => {
      field.onChange(url);
      field.onBlur();
      onUrlChange?.(url);
    },
    [field, onUrlChange],
  );

  return <MediaUploader {...uploaderProps} initialUrl={resolvedInitialUrl} onUrlChange={handleUrlChange} />;
};
