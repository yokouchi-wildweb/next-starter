// src/lib/storage/hooks/useAppStorage.ts
"use client";

import { useCallback, useRef } from "react";
import { appStorageClient } from "../client/appStorageClient";
import { getPathFromStorageUrl } from "../client/directStorageClient";

export function useAppStorage(basePath: string) {
  const pathRef = useRef<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      const { url, path } = await appStorageClient.upload(basePath, file);
      pathRef.current = path;
      return url;
    },
    [basePath],
  );

  const remove = useCallback(async (url?: string | null) => {
    const path = pathRef.current ?? (url ? getPathFromStorageUrl(url) : null);
    if (path) {
      await appStorageClient.remove(path);
      if (pathRef.current === path) {
        pathRef.current = null;
      }
    }
  }, []);

  return { upload, remove } as const;
}
