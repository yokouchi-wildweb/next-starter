// src/hooks/useImageUploaderField.ts

import { useCallback } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useDirectStorage } from "@/lib/storage/hooks/useDirectStorage";
import { useBeforeUnloadCleanup } from "./useBeforeUnloadCleanup";

export function useImageUploaderField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(
  methods: UseFormReturn<TFieldValues>,
  name: TName,
  uploadPath: string,
  enableCleanup = true,
) {
  const { upload, remove } = useDirectStorage(uploadPath);
  const { markDeleted } = useBeforeUnloadCleanup(
    methods,
    name,
    remove,
    enableCleanup,
  );

  const handleDelete = useCallback(
    async (url: string) => {
      await remove(url);
      markDeleted();
    },
    [remove, markDeleted],
  );

  return { upload, remove: handleDelete, markDeleted } as const;
}
