// src/lib/mediaInputSuite/hooks/usePendingMediaUploads.ts
//
// 編集中にアップロードして、まだ業務保存で採用されていないファイルを追跡し、cleanup で discard する。
// 追跡・discard の規則は pendingUploadTracker.ts（storage ref だけ・最終値に残ったものは消さない）。

import { useCallback, useEffect, useRef } from "react";

import { storageClient } from "@/lib/storage/client/storageClient";

import { createPendingUploadTracker, type PendingUploadTracker } from "./pendingUploadTracker";

export const usePendingMediaUploads = (options?: { cleanupOnUnmount?: boolean }) => {
  const { cleanupOnUnmount = true } = options ?? {};
  const trackerRef = useRef<PendingUploadTracker | null>(null);
  if (trackerRef.current == null) {
    trackerRef.current = createPendingUploadTracker({ discard: (objectId) => storageClient.discard(objectId) });
  }

  const register = useCallback((url: string | null) => {
    trackerRef.current?.register(url);
  }, []);

  const commit = useCallback((url: string | null) => {
    trackerRef.current?.commit(url);
  }, []);

  const cleanup = useCallback(async () => {
    await trackerRef.current?.cleanup();
  }, []);

  useEffect(() => {
    if (!cleanupOnUnmount) return;
    return () => {
      void cleanup();
    };
  }, [cleanup, cleanupOnUnmount]);

  return { register, commit, cleanup } as const;
};
