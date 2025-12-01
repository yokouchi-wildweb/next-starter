"use client";

import { useCallback } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import type { SelectedMediaMetadata } from "../types";

export type MediaMetadataBinding<TFieldValues extends FieldValues> = Partial<{
  sizeBytes: FieldPath<TFieldValues>;
  width: FieldPath<TFieldValues>;
  height: FieldPath<TFieldValues>;
  aspectRatio: FieldPath<TFieldValues>;
  orientation: FieldPath<TFieldValues>;
  mimeType: FieldPath<TFieldValues>;
  src: FieldPath<TFieldValues>;
  durationSec: FieldPath<TFieldValues>;
  durationFormatted: FieldPath<TFieldValues>;
}>;

export type UseMediaMetadataBindingOptions<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  binding: MediaMetadataBinding<TFieldValues>;
  setValueOptions?: {
    shouldDirty?: boolean;
    shouldValidate?: boolean;
  };
};

export const useMediaMetadataBinding = <TFieldValues extends FieldValues>({
  methods,
  binding,
  setValueOptions,
}: UseMediaMetadataBindingOptions<TFieldValues>) => {
  const shouldDirty = setValueOptions?.shouldDirty ?? true;
  const shouldValidate = setValueOptions?.shouldValidate ?? false;

  return useCallback(
    (metadata: SelectedMediaMetadata) => {
      const shouldReset = metadata.image === null && metadata.video === null;
      if (shouldReset) {
        (
          Object.entries(binding) as [
            keyof MediaMetadataBinding<TFieldValues>,
            FieldPath<TFieldValues> | undefined,
          ][]
        ).forEach(([, fieldName]) => {
          if (!fieldName) return;
          methods.setValue(fieldName, null as any, {
            shouldDirty,
            shouldValidate,
          });
        });
        return;
      }

      const target = metadata.video ?? metadata.image;
      if (!target) {
        return;
      }
      (
        [
          ["sizeBytes", target.sizeBytes],
          ["width", target.width],
          ["height", target.height],
          ["aspectRatio", target.aspectRatio],
          ["orientation", target.orientation],
          ["mimeType", target.mimeType ?? null],
          ["src", target.src ?? null],
          ["durationSec", "durationSec" in target ? target.durationSec : null],
          [
            "durationFormatted",
            "durationFormatted" in target ? target.durationFormatted : null,
          ],
        ] as const
      ).forEach(([key, value]) => {
        const fieldName = binding[key];
        if (!fieldName) return;
        methods.setValue(fieldName, (value ?? null) as any, {
          shouldDirty,
          shouldValidate,
        });
      });
    },
    [binding, methods, shouldDirty, shouldValidate],
  );
};
