// src/features/core/purchaseRequest/hooks/usePurchaseStatusPolling.ts

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getPurchaseStatus } from "../services/client/purchaseRequestClient";

const POLL_INTERVAL = 2000; // 2秒
const MAX_POLL_COUNT = 30; // 最大30回 = 60秒

type PollingState = {
  /** エラーメッセージ */
  error: string | null;
  /** ポーリング中かどうか */
  isPolling: boolean;
};

/**
 * 購入ステータスをポーリングし、結果に応じてリダイレクトするフック
 *
 * @param requestId 購入リクエストID
 * @returns ポーリング状態
 */
export function usePurchaseStatusPolling(requestId: string | null): PollingState {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const pollCountRef = useRef(0);
  const isPollingRef = useRef(false);
  const isMountedRef = useRef(true);

  const redirectToComplete = useCallback(
    (id: string) => {
      router.replace(`/coins/purchase/complete?request_id=${id}`);
    },
    [router]
  );

  const redirectToFailed = useCallback(
    (id: string, params: { errorCode?: string; reason?: string }) => {
      const searchParams = new URLSearchParams({ request_id: id });
      if (params.errorCode) searchParams.set("error_code", params.errorCode);
      if (params.reason) searchParams.set("reason", params.reason);
      router.replace(`/coins/purchase/failed?${searchParams.toString()}`);
    },
    [router]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!requestId) {
      setError("リクエストIDが指定されていません。");
      setIsPolling(false);
      return;
    }

    const pollStatus = async () => {
      // 重複実行を防止
      if (isPollingRef.current || !isMountedRef.current) return;
      isPollingRef.current = true;

      try {
        const status = await getPurchaseStatus(requestId);

        if (!isMountedRef.current) return;

        switch (status.status) {
          case "completed":
            setIsPolling(false);
            redirectToComplete(requestId);
            return;

          case "failed":
            setIsPolling(false);
            redirectToFailed(requestId, {
              errorCode: status.errorCode ?? "UNKNOWN",
            });
            return;

          case "expired":
            setIsPolling(false);
            redirectToFailed(requestId, { reason: "expired" });
            return;

          case "processing":
          case "pending":
            // まだ処理中なので続行
            break;

          default:
            setError(`不明なステータス: ${status.status}`);
            setIsPolling(false);
            return;
        }

        pollCountRef.current += 1;

        if (pollCountRef.current >= MAX_POLL_COUNT) {
          setIsPolling(false);
          redirectToFailed(requestId, { reason: "timeout" });
          return;
        }

        // 次のポーリングをスケジュール
        isPollingRef.current = false;
        setTimeout(pollStatus, POLL_INTERVAL);
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error("Status polling failed:", err);
        setError("ステータスの確認中にエラーが発生しました。");
        setIsPolling(false);
      }
    };

    // 初回ポーリング開始
    pollStatus();

    // クリーンアップ
    return () => {
      isMountedRef.current = false;
      isPollingRef.current = true;
    };
  }, [requestId, redirectToComplete, redirectToFailed]);

  return { error, isPolling };
}
