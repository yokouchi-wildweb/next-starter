// src/lib/storage/hooks/useDirectStorage.ts

"use client";

import { useCallback, useRef } from "react";
import { directStorageClient, getPathFromStorageUrl } from "../client/directStorageClient";
import { uuidv7 } from "uuidv7";

/**
 * 汎用の Firebase Storage アップローダーフック
 * @param basePath Firebase Storage 内の保存フォルダ (例: "cards/main")
 */
export function useDirectStorage(basePath: string) {
  const pathRef = useRef<string | null>(null);

  const upload = useCallback(
    async (file: Blob | File) => {
      const ext =
        "name" in file && file.name.includes(".")
          ? file.name.substring(file.name.lastIndexOf("."))
          : "";
      const path = `${basePath}/${uuidv7()}${ext}`;
      pathRef.current = path;
      return directStorageClient.upload(path, file);
    },
    [basePath],
  );

  const remove = useCallback(async (url?: string | null) => {
    const path = pathRef.current ?? (url ? getPathFromStorageUrl(url) : null);
    if (path) {
      await directStorageClient.remove(path);
      if (pathRef.current === path) {
        pathRef.current = null;
      }
    }
  }, []);

  return { upload, remove } as const;
}
