"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { ControlledMediaUploader, type ControlledMediaUploaderProps } from "./ControlledMediaUploader";
import { usePendingMediaUploads, usePendingMediaDeletion } from "@/lib/mediaInputSuite";

type ControlledMediaUploaderExternalProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<
  ControlledMediaUploaderProps<TFieldValues, TName>,
  "field" | "defaultUrl" | "onUrlChange" | "onUploadingChange" | "onRegisterPendingUpload" | "onRegisterPendingDelete"
>;

export type ControlledMediaUploaderBridgeProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ControlledMediaUploaderProps<TFieldValues, TName>, "field">;

export type MediaUploaderFieldRenderer<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = (field: ControllerRenderProps<TFieldValues, TName>) => ReactElement;

export type UseMediaUploaderFieldOptions<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  methods: UseFormReturn<TFieldValues>;
  name: TName;
  defaultValue?: string | null;
  uploaderProps: ControlledMediaUploaderExternalProps<TFieldValues, TName>;
  cleanupOnUnmount?: boolean;
  onUrlChange?: (url: string | null) => void;
};

export type UseMediaUploaderFieldResult<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  controlledProps: ControlledMediaUploaderBridgeProps<TFieldValues, TName>;
  render: MediaUploaderFieldRenderer<TFieldValues, TName>;
  isUploading: boolean;
  commit: (finalUrl?: string | null) => Promise<void>;
  reset: () => Promise<void>;
};

export function useMediaUploaderField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  methods,
  name,
  defaultValue = null,
  uploaderProps,
  cleanupOnUnmount = true,
  onUrlChange,
}: UseMediaUploaderFieldOptions<TFieldValues, TName>): UseMediaUploaderFieldResult<TFieldValues, TName> {
  const [isUploading, setUploading] = useState(false);
  const originalUrlRef = useRef<string | null>((methods.getValues(name) as string | null) ?? defaultValue ?? null);

  useEffect(() => {
    originalUrlRef.current = defaultValue ?? (methods.getValues(name) as string | null) ?? null;
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

  const handleUrlChange = useCallback(
    (url: string | null) => {
      onUrlChange?.(url);
      if (!url) {
        revertPendingDeletion();
        return;
      }
      if (url === originalUrlRef.current) {
        commitPendingUpload(url);
      }
    },
    [commitPendingUpload, onUrlChange, revertPendingDeletion],
  );

  const handleRegisterPendingDelete = useCallback(
    (url: string | null) => {
      if (!url) return;
      if (url === originalUrlRef.current) {
        markDelete(url);
        return;
      }
      registerPendingUpload(url);
    },
    [markDelete, registerPendingUpload],
  );

  const controlledProps = useMemo(
    () => ({
      ...uploaderProps,
      defaultUrl: defaultValue ?? null,
      onUploadingChange: handleUploadingChange,
      onUrlChange: handleUrlChange,
      onRegisterPendingUpload: registerPendingUpload,
      onRegisterPendingDelete: handleRegisterPendingDelete,
    }),
    [
      uploaderProps,
      defaultValue,
      handleUploadingChange,
      handleUrlChange,
      registerPendingUpload,
      handleRegisterPendingDelete,
    ],
  );

  const render = useCallback(
    (field: ControllerRenderProps<TFieldValues, TName>) => (
      <ControlledMediaUploader field={field} {...controlledProps} />
    ),
    [controlledProps],
  );

  const commit = useCallback(
    async (finalUrl?: string | null) => {
      const resolvedUrl =
        typeof finalUrl === "undefined" ? ((methods.getValues(name) as string | null) ?? null) : finalUrl;
      commitPendingUpload(resolvedUrl ?? null);
      await commitPendingDeletion();
      await cleanupPendingUploads();
      originalUrlRef.current = resolvedUrl ?? null;
    },
    [cleanupPendingUploads, commitPendingDeletion, commitPendingUpload, methods, name],
  );

  const reset = useCallback(async () => {
    await cleanupPendingUploads();
    revertPendingDeletion();
    methods.setValue(name, originalUrlRef.current as any, { shouldDirty: false });
  }, [cleanupPendingUploads, methods, name, revertPendingDeletion]);

  return { controlledProps, render, isUploading, commit, reset };
}
