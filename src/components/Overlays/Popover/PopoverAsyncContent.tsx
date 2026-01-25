// src/components/Overlays/Popover/PopoverAsyncContent.tsx

"use client";

import { type ReactNode, useState, useEffect, useCallback, useRef } from "react";

import { Spinner } from "@/components/Overlays/Loading/Spinner";

export type PopoverAsyncContentProps<T> = {
  /** データ取得関数 */
  fetcher: () => Promise<T>;
  /** ローディング中の表示（省略時はデフォルトスピナー） */
  loading?: ReactNode;
  /** エラー時の表示（省略時はデフォルトエラー表示） */
  error?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  /** データ取得後の表示 */
  children: (data: T) => ReactNode;
  /** ローディング表示の最小時間（ms）。ちらつき防止用 */
  minLoadingTime?: number;
  /** 取得成功時のコールバック */
  onSuccess?: (data: T) => void;
  /** 取得失敗時のコールバック */
  onError?: (error: Error) => void;
};

// デフォルトのローディング表示
function DefaultLoading() {
  return (
    <div className="flex items-center justify-center py-6">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}

// デフォルトのエラー表示
function DefaultError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-sm text-destructive">読み込みに失敗しました</p>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 text-xs text-primary underline hover:no-underline"
      >
        再試行
      </button>
    </div>
  );
}

/**
 * ポップオーバー内で非同期データを取得して表示するコンポーネント
 *
 * PopoverのbodyやInfoPopoverのchildrenとして使用します。
 * コンポーネントがマウントされた時（=ポップオーバーが開いた時）に
 * 自動でデータを取得し、ローディング→データ表示（またはエラー）を管理します。
 *
 * @example
 * // 基本使用
 * <InfoPopover trigger={<Button>詳細</Button>}>
 *   <PopoverAsyncContent fetcher={() => userService.getDetails(userId)}>
 *     {(user) => <UserDetails user={user} />}
 *   </PopoverAsyncContent>
 * </InfoPopover>
 *
 * @example
 * // カスタムローディング・エラー表示
 * <Popover trigger={<Button>プレビュー</Button>}>
 *   <PopoverAsyncContent
 *     fetcher={() => productService.getPreview(productId)}
 *     loading={<ProductSkeleton />}
 *     error={(err, retry) => (
 *       <ErrorMessage error={err} onRetry={retry} />
 *     )}
 *   >
 *     {(product) => <ProductPreview product={product} />}
 *   </PopoverAsyncContent>
 * </Popover>
 *
 * @example
 * // 最小ローディング時間（ちらつき防止）
 * <PopoverAsyncContent
 *   fetcher={() => api.fetchData()}
 *   minLoadingTime={300} // 最低300msはローディング表示
 * >
 *   {(data) => <Content data={data} />}
 * </PopoverAsyncContent>
 */
export function PopoverAsyncContent<T>({
  fetcher,
  loading,
  error: errorContent,
  children,
  minLoadingTime = 0,
  onSuccess,
  onError,
}: PopoverAsyncContentProps<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const isMountedRef = useRef(true);

  // データ取得
  const fetchData = useCallback(async () => {
    const startTime = Date.now();
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();

      // 最小ローディング時間を確保
      if (minLoadingTime > 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed < minLoadingTime) {
          await new Promise((resolve) => setTimeout(resolve, minLoadingTime - elapsed));
        }
      }

      if (isMountedRef.current) {
        setData(result);
        setIsLoading(false);
        onSuccess?.(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsLoading(false);
        onError?.(error);
      }
    }
  }, [minLoadingTime, onSuccess, onError]);

  // 再試行
  const retry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // マウント時にデータを取得
  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  // ローディング中
  if (isLoading) {
    return <>{loading ?? <DefaultLoading />}</>;
  }

  // エラー
  if (error) {
    if (typeof errorContent === "function") {
      return <>{errorContent(error, retry)}</>;
    }
    return <>{errorContent ?? <DefaultError error={error} onRetry={retry} />}</>;
  }

  // データ表示
  if (data !== undefined) {
    return <>{children(data)}</>;
  }

  // データがundefinedの場合（通常は到達しない）
  return <>{loading ?? <DefaultLoading />}</>;
}

export default PopoverAsyncContent;
