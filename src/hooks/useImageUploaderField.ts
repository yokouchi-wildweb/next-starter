// src/hooks/useImageUploaderField.ts

import { useCallback } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useDirectStorage } from "@/lib/storage/hooks/useDirectStorage";
import { useTemporaryUploadCleanup } from "./useTemporaryUploadCleanup";

type CleanupOptions = {
  enableCleanup?: boolean;
  cleanupOnRouteChange?: boolean;
};

function resolveOptions(option?: boolean | CleanupOptions): CleanupOptions {
  if (typeof option === "boolean" || typeof option === "undefined") {
    return { enableCleanup: option ?? true };
  }
  return option;
}

export function useImageUploaderField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(
  methods: UseFormReturn<TFieldValues>,
  name: TName,
  uploadPath: string,
  option?: boolean | CleanupOptions,
) {
  const { enableCleanup = true, cleanupOnRouteChange = false } = resolveOptions(option);
  const { upload, remove } = useDirectStorage(uploadPath);

  const { markDeleted } = useTemporaryUploadCleanup(methods, name, remove, {
    enabled: enableCleanup,
    cleanupOnBeforeUnload: enableCleanup,
    cleanupOnRouteChange,
  });

  const handleDelete = useCallback(
    async (url: string) => {
      await remove(url);
      markDeleted(url);
    },
    [remove, markDeleted],
  );

  return { upload, remove: handleDelete, markDeleted } as const;
}
