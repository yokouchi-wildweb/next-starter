"use client";

import { useCallback } from "react";

import type { SelectedMediaMetadata, MediaOrientation } from "../types";

export type MediaMetadataActions = Partial<{
  sizeBytes: (value: number | null) => void;
  width: (value: number | null) => void;
  height: (value: number | null) => void;
  aspectRatio: (value: number | null) => void;
  orientation: (value: MediaOrientation | null) => void;
  mimeType: (value: string | null) => void;
  src: (value: string | null) => void;
  durationSec: (value: number | null) => void;
  durationFormatted: (value: string | null) => void;
}>;

export type UseMediaMetadataActionsOptions = {
  actions: MediaMetadataActions;
};

export const useMediaMetadataActions = ({ actions }: UseMediaMetadataActionsOptions) => {
  return useCallback(
    (metadata: SelectedMediaMetadata) => {
      const target = metadata.video ?? metadata.image;

      const invoke = <K extends keyof MediaMetadataActions>(key: K, value: Parameters<NonNullable<MediaMetadataActions[K]>>[0]) => {
        const handler = actions[key];
        if (handler) {
          handler(value);
        }
      };

      if (!target) {
        invoke("sizeBytes", null);
        invoke("width", null);
        invoke("height", null);
        invoke("aspectRatio", null);
        invoke("orientation", null);
        invoke("mimeType", null);
        invoke("src", null);
        invoke("durationSec", null);
        invoke("durationFormatted", null);
        return;
      }

      invoke("sizeBytes", target.sizeBytes ?? null);
      invoke("width", target.width ?? null);
      invoke("height", target.height ?? null);
      invoke("aspectRatio", target.aspectRatio ?? null);
      invoke("orientation", target.orientation ?? null);
      invoke("mimeType", target.mimeType ?? null);
      invoke("src", target.src ?? null);

      if ("durationSec" in target) {
        invoke("durationSec", target.durationSec ?? null);
      } else {
        invoke("durationSec", null);
      }

      if ("durationFormatted" in target) {
        invoke("durationFormatted", target.durationFormatted ?? null);
      } else {
        invoke("durationFormatted", null);
      }
    },
    [actions],
  );
};

