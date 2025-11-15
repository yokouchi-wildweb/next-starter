// src/hooks/useTemporaryUploadCleanup.ts

"use client";

import { useCallback, useEffect, useRef } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useRouteChangeEffect } from "./useRouteChangeEffect";

type Options = {
  enabled?: boolean;
  cleanupOnRouteChange?: boolean;
  cleanupOnBeforeUnload?: boolean;
};

function toUrlList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

export function useTemporaryUploadCleanup<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(
  methods: UseFormReturn<TFieldValues>,
  field: TName,
  remove: (url: string) => Promise<void> | void,
  options: Options = {},
) {
  const {
    enabled = true,
    cleanupOnRouteChange = false,
    cleanupOnBeforeUnload = false,
  } = options;
  const handledUrlsRef = useRef(new Set<string>());

  const resolveUrls = useCallback(() => toUrlList(methods.getValues(field)), [methods, field]);

  const markDeleted = useCallback(
    (value?: string | string[]) => {
      if (!enabled) return;
      const urls = value ? toUrlList(value) : resolveUrls();
      urls.forEach((url) => {
        handledUrlsRef.current.add(url);
      });
    },
    [enabled, resolveUrls],
  );

  const cleanup = useCallback(() => {
    if (!enabled) return;

    const urls = resolveUrls();
    urls.forEach((url) => {
      if (!url || handledUrlsRef.current.has(url)) {
        return;
      }

      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ pathOrUrl: url })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/storage/delete", blob);
      } else {
        void remove(url);
      }

      handledUrlsRef.current.add(url);
    });
  }, [enabled, resolveUrls, remove]);

  useEffect(() => {
    if (!cleanupOnBeforeUnload || !enabled) return;

    const onBeforeUnload = () => {
      cleanup();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [cleanupOnBeforeUnload, enabled, cleanup]);

  useRouteChangeEffect(() => cleanup(), enabled && cleanupOnRouteChange);

  return { cleanup, markDeleted } as const;
}
