"use client";

import { useCallback } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";

import { MediaUploaderMulti, type MediaUploaderMultiProps } from "@/lib/mediaInputSuite";

type BaseProps = Omit<MediaUploaderMultiProps, "initialUrls" | "onUrlsChange">;

export type ControlledMediaUploaderMultiProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseProps & {
  field: ControllerRenderProps<TFieldValues, TName>;
  defaultUrls?: string[] | null;
  onUrlsChange?: (urls: string[]) => void;
  onRegisterPendingUpload?: (url: string | null) => void;
  onRegisterPendingDelete?: (url: string | null) => void;
};

// field.value が配列でないときの代わり。毎回新しい [] を渡すと MediaUploaderMulti の再同期が描画のたびに走る
const EMPTY_URLS: string[] = [];

/**
 * RHF の Controller と MediaUploaderMulti をブリッジする
 * field.value は string[] を想定（mediaUploaderMulti スキーマで配列）
 */
export const ControlledMediaUploaderMulti = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  defaultUrls = null,
  onUrlsChange,
  onUploadingChange,
  onRegisterPendingUpload,
  onRegisterPendingDelete,
  ...uploaderProps
}: ControlledMediaUploaderMultiProps<TFieldValues, TName>) => {
  const fieldValue = (Array.isArray(field.value) ? field.value : null) as string[] | null;
  const resolvedInitialUrls = fieldValue ?? defaultUrls ?? EMPTY_URLS;

  const handleUrlsChange = useCallback(
    (urls: string[]) => {
      field.onChange(urls);
      field.onBlur();
      onUrlsChange?.(urls);
    },
    [field, onUrlsChange],
  );

  return (
    <MediaUploaderMulti
      {...uploaderProps}
      initialUrls={resolvedInitialUrls}
      onUrlsChange={handleUrlsChange}
      onUploadingChange={onUploadingChange}
      onRegisterPendingUpload={onRegisterPendingUpload}
      onRegisterPendingDelete={onRegisterPendingDelete}
    />
  );
};
