import { useCallback, useRef } from "react";

import { directStorageClient, getPathFromStorageUrl } from "@/lib/storage/client/directStorageClient";

export const usePendingMediaDeletion = () => {
  const pendingDeleteRef = useRef<Set<string>>(new Set());

  const markDelete = useCallback((url: string | null) => {
    if (!url) return;
    pendingDeleteRef.current.add(url);
  }, []);

  const commit = useCallback(async () => {
    const urls = Array.from(pendingDeleteRef.current);
    pendingDeleteRef.current.clear();
    await Promise.all(
      urls.map(async (url) => {
        const path = getPathFromStorageUrl(url);
        if (!path) return;
        try {
          await directStorageClient.remove(path);
        } catch (error) {
          console.error(error);
        }
      }),
    );
  }, []);

  const revert = useCallback(() => {
    pendingDeleteRef.current.clear();
  }, []);

  return { markDelete, commit, revert } as const;
};
