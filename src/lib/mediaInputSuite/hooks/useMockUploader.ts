"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UploadProgress = { loaded: number; total: number; percent: number };

export type MockUploaderOptions = {
  uploadPath?: string;
  simulateError?: boolean;
  durationMs?: number;
};

export function useMockUploader({ uploadPath = "uploads/demo", simulateError = false, durationMs = 1200 }: MockUploaderOptions = {}) {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      abortRef.current();
    };
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setProgress({ loaded: 0, total: file.size || 100, percent: 0 });

      await new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const tick = () => {
          const elapsed = performance.now() - start;
          const ratio = Math.min(1, elapsed / durationMs);
          const loaded = Math.floor(ratio * (file.size || 100));
          setProgress({ loaded, total: file.size || 100, percent: Math.floor(ratio * 100) });
          if (ratio >= 1) {
            if (simulateError) {
              reject(new Error("アップロードに失敗しました（モック）"));
              return;
            }
            resolve();
            return;
          }
          abortRef.current = () => reject(new Error("アップロードをキャンセルしました"));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      const fakeUrl = `https://example.com/${uploadPath}/${encodeURIComponent(file.name)}`;
      return fakeUrl;
    },
    [durationMs, simulateError, uploadPath],
  );

  const reset = useCallback(() => {
    setProgress(null);
    setError(null);
  }, []);

  return { upload, progress, error, reset } as const;
}
