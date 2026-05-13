"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import {
  ControlledMediaUploaderMulti,
  type ControlledMediaUploaderMultiProps,
} from "./ControlledMediaUploaderMulti";
import { usePendingMediaUploads, usePendingMediaDeletion } from "@/lib/mediaInputSuite";

type ControlledMediaUploaderMultiExternalProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<
  ControlledMediaUploaderMultiProps<TFieldValues, TName>,
  | "field"
  | "defaultUrls"
  | "onUrlsChange"
  | "onUploadingChange"
  | "onRegisterPendingUpload"
  | "onRegisterPendingDelete"
>;

export type ControlledMediaUploaderMultiBridgeProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ControlledMediaUploaderMultiProps<TFieldValues, TName>, "field">;

export type MediaUploaderMultiFieldRenderer<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = (field: ControllerRenderProps<TFieldValues, TName>) => ReactElement;

export type UseMediaUploaderMultiFieldOptions<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  methods: UseFormReturn<TFieldValues>;
  name: TName;
  defaultValue?: string[] | null;
  uploaderProps: ControlledMediaUploaderMultiExternalProps<TFieldValues, TName>;
  cleanupOnUnmount?: boolean;
  onUrlsChange?: (urls: string[]) => void;
};

export type UseMediaUploaderMultiFieldResult<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  controlledProps: ControlledMediaUploaderMultiBridgeProps<TFieldValues, TName>;
  render: MediaUploaderMultiFieldRenderer<TFieldValues, TName>;
  isUploading: boolean;
  commit: (finalUrls?: string[] | null) => Promise<void>;
  reset: () => Promise<void>;
};

/**
 * 単一版 useMediaUploaderField の複数枚版。
 *
 * pending の方針：
 * - 新規アップロード完了 → registerPendingUpload (URL のクリーンアップ候補)
 * - 削除 (元から存在した URL) → markDelete (commit 時に実削除)
 * - 削除 (このセッションで上がった URL) → registerPendingUpload (commit 時に cleanup で消える)
 *
 * commit() / reset() の意味は単一版と同じ。
 */
export function useMediaUploaderMultiField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  methods,
  name,
  defaultValue = null,
  uploaderProps,
  cleanupOnUnmount = true,
  onUrlsChange,
}: UseMediaUploaderMultiFieldOptions<TFieldValues, TName>): UseMediaUploaderMultiFieldResult<TFieldValues, TName> {
  const [isUploading, setUploading] = useState(false);

  const readInitialUrls = (): string[] => {
    const value = methods.getValues(name) as unknown;
    if (Array.isArray(value)) return value as string[];
    if (Array.isArray(defaultValue)) return defaultValue;
    return [];
  };

  const originalUrlsRef = useRef<string[]>(readInitialUrls());

  // defaultValue が外側から再供給されたときに originalUrlsRef を同期
  useEffect(() => {
    if (Array.isArray(defaultValue)) {
      originalUrlsRef.current = defaultValue;
      return;
    }
    const value = methods.getValues(name) as unknown;
    if (Array.isArray(value)) {
      originalUrlsRef.current = value as string[];
    }
  }, [defaultValue, methods, name]);

  const {
    register: registerPendingUpload,
    commit: commitPendingUpload,
    cleanup: cleanupPendingUploads,
  } = usePendingMediaUploads({ cleanupOnUnmount });

  const {
    markDelete,
    commit: commitPendingDeletion,
    revert: revertPendingDeletion,
  } = usePendingMediaDeletion();

  const handleUploadingChange = useCallback((uploading: boolean) => {
    setUploading(uploading);
  }, []);

  const handleUrlsChange = useCallback(
    (urls: string[]) => {
      onUrlsChange?.(urls);
    },
    [onUrlsChange],
  );

  const handleRegisterPendingDelete = useCallback(
    (url: string | null) => {
      if (!url) return;
      if (originalUrlsRef.current.includes(url)) {
        markDelete(url);
        return;
      }
      // このセッションで上がった URL → cleanup 対象として登録
      registerPendingUpload(url);
    },
    [markDelete, registerPendingUpload],
  );

  const controlledProps = useMemo(
    () => ({
      ...uploaderProps,
      defaultUrls: Array.isArray(defaultValue) ? defaultValue : null,
      onUploadingChange: handleUploadingChange,
      onUrlsChange: handleUrlsChange,
      onRegisterPendingUpload: registerPendingUpload,
      onRegisterPendingDelete: handleRegisterPendingDelete,
    }),
    [
      uploaderProps,
      defaultValue,
      handleUploadingChange,
      handleUrlsChange,
      registerPendingUpload,
      handleRegisterPendingDelete,
    ],
  );

  const render = useCallback(
    (field: ControllerRenderProps<TFieldValues, TName>) => (
      <ControlledMediaUploaderMulti field={field} {...controlledProps} />
    ),
    [controlledProps],
  );

  const commit = useCallback(
    async (finalUrls?: string[] | null) => {
      const resolved =
        Array.isArray(finalUrls)
          ? finalUrls
          : ((Array.isArray(methods.getValues(name)) ? (methods.getValues(name) as string[]) : []) ?? []);
      // 残った URL を pending upload から外す（cleanup 対象から除外）
      resolved.forEach((url) => commitPendingUpload(url));
      await commitPendingDeletion();
      await cleanupPendingUploads();
      originalUrlsRef.current = resolved;
    },
    [cleanupPendingUploads, commitPendingDeletion, commitPendingUpload, methods, name],
  );

  const reset = useCallback(async () => {
    await cleanupPendingUploads();
    revertPendingDeletion();
    methods.setValue(name, originalUrlsRef.current as never, { shouldDirty: false });
  }, [cleanupPendingUploads, methods, name, revertPendingDeletion]);

  return { controlledProps, render, isUploading, commit, reset };
}
