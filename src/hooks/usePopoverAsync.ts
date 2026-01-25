// src/hooks/usePopoverAsync.ts

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type UsePopoverAsyncOptions<T> = {
  /** データ取得関数 */
  fetcher: () => Promise<T>;
  /** 有効/無効（falseの場合はフェッチしない） */
  enabled?: boolean;
  /** キャッシュ有効時間（ms）。0で毎回フェッチ */
  staleTime?: number;
  /** 成功時のコールバック */
  onSuccess?: (data: T) => void;
  /** エラー時のコールバック */
  onError?: (error: Error) => void;
  /** 初期データ */
  initialData?: T;
};

export type UsePopoverAsyncResult<T> = {
  /** ポップオーバーの開閉状態 */
  isOpen: boolean;
  /** 開閉状態を変更する関数 */
  setIsOpen: (open: boolean) => void;
  /** 取得したデータ */
  data: T | undefined;
  /** ローディング中かどうか */
  isLoading: boolean;
  /** エラー */
  error: Error | null;
  /** データを再取得する関数 */
  refetch: () => void;
  /** ポップオーバーに直接spreadできるprops */
  popoverProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
};

/**
 * ポップオーバーの非同期データ取得を管理するHook
 *
 * @example
 * // 基本使用
 * const { popoverProps, data, isLoading, error } = usePopoverAsync({
 *   fetcher: () => userService.getDetails(userId),
 * });
 *
 * <InfoPopover {...popoverProps} trigger={<Button>詳細</Button>}>
 *   {isLoading ? <Skeleton /> : <UserDetails data={data} />}
 * </InfoPopover>
 *
 * @example
 * // キャッシュ付き
 * const { popoverProps, data } = usePopoverAsync({
 *   fetcher: () => categoryService.list(),
 *   staleTime: 60000, // 1分間はキャッシュを使用
 * });
 *
 * @example
 * // SelectPopoverでoptionsを動的取得
 * const { popoverProps, data: options, isLoading } = usePopoverAsync({
 *   fetcher: () => tagService.list(),
 * });
 *
 * <SelectPopover
 *   {...popoverProps}
 *   options={options ?? []}
 *   // ...
 * />
 */
export function usePopoverAsync<T>({
  fetcher,
  enabled = true,
  staleTime = 0,
  onSuccess,
  onError,
  initialData,
}: UsePopoverAsyncOptions<T>): UsePopoverAsyncResult<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // キャッシュ管理
  const lastFetchedAtRef = useRef<number | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // キャッシュが有効かどうかを判定
  const isCacheValid = useCallback(() => {
    if (staleTime === 0) return false;
    if (lastFetchedAtRef.current === null) return false;
    return Date.now() - lastFetchedAtRef.current < staleTime;
  }, [staleTime]);

  // データ取得
  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      setData(result);
      lastFetchedAtRef.current = Date.now();
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, onSuccess, onError]);

  // 強制的に再取得
  const refetch = useCallback(() => {
    lastFetchedAtRef.current = null;
    fetchData();
  }, [fetchData]);

  // 開閉状態変更時の処理
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);

      // 開く時にデータを取得（キャッシュが無効な場合のみ）
      if (open && enabled && !isCacheValid()) {
        fetchData();
      }
    },
    [enabled, isCacheValid, fetchData]
  );

  // enabled が変わった時にキャッシュをクリア
  useEffect(() => {
    if (!enabled) {
      lastFetchedAtRef.current = null;
    }
  }, [enabled]);

  return {
    isOpen,
    setIsOpen: handleOpenChange,
    data,
    isLoading,
    error,
    refetch,
    popoverProps: {
      open: isOpen,
      onOpenChange: handleOpenChange,
    },
  };
}

export default usePopoverAsync;
