// src/hooks/useBeforeUnloadCleanup.ts

"use client";

import { useCallback, useEffect, useRef } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

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
  const deletedRef = useRef(false);

  const markDeleted = useCallback(() => {
    deletedRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = () => {
      if (deletedRef.current) return;
      const url = methods.getValues(field);
      if (url) {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify({ pathOrUrl: url })], {
            type: "application/json",
          });
          navigator.sendBeacon("/api/storage/delete", blob);
        } else {
          void remove(url);
        }
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [methods, field, remove, enabled]);

  return { markDeleted } as const;
}
