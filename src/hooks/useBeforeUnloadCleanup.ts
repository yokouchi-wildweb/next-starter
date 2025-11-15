// src/hooks/useBeforeUnloadCleanup.ts

"use client";

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useTemporaryUploadCleanup } from "./useTemporaryUploadCleanup";

/**
 * Clean up an uploaded file on page unload unless explicitly marked as deleted.
 *
 * @param methods - react-hook-form methods instance
 * @param field - name of the field that stores the uploaded file URL
 * @param remove - function to delete the uploaded file
 * @param enabled - whether to enable the cleanup behavior
 */
export function useBeforeUnloadCleanup<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(
  methods: UseFormReturn<TFieldValues>,
  field: TName,
  remove: (url: string) => Promise<void> | void,
  enabled = true,
) {
  return useTemporaryUploadCleanup(methods, field, remove, {
    enabled,
    cleanupOnBeforeUnload: true,
  });
}
