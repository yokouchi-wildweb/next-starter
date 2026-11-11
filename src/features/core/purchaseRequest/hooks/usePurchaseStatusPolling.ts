// src/features/core/purchaseRequest/hooks/usePurchaseStatusPolling.ts

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { getPurchaseStatus } from "../services/client/purchaseRequestClient";

const POLL_INTERVAL = 2000; // 2秒
const MAX_POLL_COUNT = 30; // 最大30回 = 60秒

type PollingState = {
  /** エラーメッセージ */
  error: string | null;
  /** ポーリング中かどうか */
  isPolling: boolean;
};

export type UsePurchaseStatusPollingParams = {
  /** 購入リクエストID */
  requestId: string | null;
  /** URLスラッグ（既定のリダイレクト先のパス用） */
  slug: string;
  /** 完了時のリダイレクト先のパス（省略 = /wallet/<slug>/purchase/complete）。request_id を付けて移る */
  completePath?: string;
  /** 失敗・期限切れ・タイムアウト時のリダイレクト先のパス（省略 = /wallet/<slug>/purchase/failed）。request_id と error_code / reason を付けて移る */
  failedPath?: string;
};

/**
 * リダイレクト先の URL を組み立てる（純関数）。
 * クエリは request_id → error_code → reason の順（値のあるものだけ）。パスに ? があれば & で続ける
 */
export function buildPurchaseResultUrl(
  path: string,
  query: { requestId: string; errorCode?: string; reason?: string },
): string {
  const searchParams = new URLSearchParams({ request_id: query.requestId });
  if (query.errorCode) searchParams.set("error_code", query.errorCode);
  if (query.reason) searchParams.set("reason", query.reason);
  return `${path}${path.includes("?") ? "&" : "?"}${searchParams.toString()}`;
}

/**
 * 購入ステータスをポーリングし、結果に応じてリダイレクトするフック
 * 移り先は completePath / failedPath で変えられる（値だけ。fork が自前の購入の結果画面を持つとき。README「3.2」）
 *
 * @param params パラメータ
 * @returns ポーリング状態
 */
export function usePurchaseStatusPolling({
  requestId,
  slug,
  completePath,
  failedPath,
}: UsePurchaseStatusPollingParams): PollingState {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const pollCountRef = useRef(0);
  const isPollingRef = useRef(false);
  const isMountedRef = useRef(true);

  const completeTarget = completePath ?? `/wallet/${slug}/purchase/complete`;
  const failedTarget = failedPath ?? `/wallet/${slug}/purchase/failed`;

  const redirectToComplete = useCallback(
    (id: string) => {
      router.replace(buildPurchaseResultUrl(completeTarget, { requestId: id }));
    },
    [router, completeTarget]
  );

  const redirectToFailed = useCallback(
    (id: string, params: { errorCode?: string; reason?: string }) => {
      router.replace(buildPurchaseResultUrl(failedTarget, { requestId: id, ...params }));
    },
    [router, failedTarget]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!requestId) {
      // ポーリング(外部 API との同期)の入口。リクエスト ID が無い場合はここで結果を確定する
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
