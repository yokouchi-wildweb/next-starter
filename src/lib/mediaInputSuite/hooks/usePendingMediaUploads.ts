import { useCallback, useEffect, useRef } from "react";

import { directStorageClient, getPathFromStorageUrl } from "@/lib/storage/client/directStorageClient";

export const usePendingMediaUploads = (options?: { cleanupOnUnmount?: boolean }) => {
  const { cleanupOnUnmount = true } = options ?? {};
  const pendingUrlsRef = useRef(new Set<string>());

  const register = useCallback((url: string | null) => {
    if (!url) return;
    pendingUrlsRef.current.add(url);
  }, []);

  const commit = useCallback((url: string | null) => {
    if (!url) return;
    pendingUrlsRef.current.delete(url);
  }, []);

  const cleanup = useCallback(async () => {
    const urls = Array.from(pendingUrlsRef.current);
    pendingUrlsRef.current.clear();
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

  useEffect(() => {
    if (!cleanupOnUnmount) return;
    return () => {
      void cleanup();
    };
  }, [cleanup, cleanupOnUnmount]);

  return { register, commit, cleanup } as const;
};
