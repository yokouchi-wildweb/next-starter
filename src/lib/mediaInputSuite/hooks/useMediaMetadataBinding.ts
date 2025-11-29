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
  return useCallback(
    (metadata: SelectedMediaMetadata) => {
      const target = metadata.video ?? metadata.image;
      if (!target) {
        Object.values(binding).forEach((name) => {
          if (!name) return;
          methods.setValue(name, null as any, {
            shouldDirty: setValueOptions?.shouldDirty ?? true,
            shouldValidate: setValueOptions?.shouldValidate ?? false,
          });
        });
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
          shouldDirty: setValueOptions?.shouldDirty ?? true,
          shouldValidate: setValueOptions?.shouldValidate ?? false,
        });
      });
    },
    [binding, methods, setValueOptions?.shouldDirty, setValueOptions?.shouldValidate],
  );
};

