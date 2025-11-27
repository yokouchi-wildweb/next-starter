"use client";

import { useCallback, useState, type DragEvent, type MutableRefObject } from "react";

export type UseDragAndDropOptions = {
  onDropFile?: (file: File) => void;
  disabled?: boolean;
  // 独自の drop 対象を指定したいときに使用
  rootRef?: MutableRefObject<HTMLElement | null>;
};

export function useDragAndDrop({ onDropFile, disabled = false }: UseDragAndDropOptions = {}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsDragging(true);
    },
    [disabled],
  );

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      // enter/leave は子要素でも発火するので currentTarget の範囲から外れたときのみ離脱とみなす
      if (event.currentTarget.contains(event.relatedTarget as Node)) return;
      setIsDragging(false);
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) {
        onDropFile?.(file);
      }
    },
    [disabled, onDropFile],
  );

  return {
    isDragging,
    eventHandlers: {
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
