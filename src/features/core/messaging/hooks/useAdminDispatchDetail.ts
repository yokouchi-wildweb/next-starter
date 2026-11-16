"use client";

// src/features/core/messaging/hooks/useAdminDispatchDetail.ts
//
// 管理: 送った回 1 件の画面の流れ(AdminDispatchDetail はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui)。
// - 回 1 件(useAdminDispatch)と配達の一覧(状態・経路で絞る、useAdminDispatchDeliveries)
// - 回の操作: 削除(D88)・失敗分を再送(includeUnknown = 届いたか分からない分も)・続きを送る
//   どれも成功したら配達を取り直して知らせ(toast)を出し、失敗は知らせだけ(Promise は ConfirmPopover の loading 用に返す)

import { useCallback, useState } from "react";

import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { useAdminDispatch } from "./useAdminDispatch";
import { useAdminDispatchDeliveries } from "./useAdminDispatchDeliveries";
import { useContinueDispatch } from "./useContinueDispatch";
import { useDeleteDispatch } from "./useDeleteDispatch";
import { useResendDispatch } from "./useResendDispatch";

export type UseAdminDispatchDetailOptions = {
  /** 配達の 1 回の件数(既定 50、最大 100) */
  limit?: number;
  observerOptions?: IntersectionObserverInit;
};

export function useAdminDispatchDetail(dispatchId: string, options: UseAdminDispatchDetailOptions = {}) {
  const { showToast } = useToast();
  const { dispatch, error, isLoading } = useAdminDispatch(dispatchId);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("");
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const deliveries = useAdminDispatchDeliveries(dispatchId, {
    filters: { status: deliveryStatus || undefined, channel: deliveryChannel || undefined },
    limit: options.limit,
    observerOptions: options.observerOptions,
  });
  const { revalidate: revalidateDeliveries } = deliveries;
  const { continueSending } = useContinueDispatch(dispatchId);
  const { trigger: deleteTrigger } = useDeleteDispatch(dispatchId);
  const { trigger: resendTrigger } = useResendDispatch(dispatchId);

  /** 削除する(未送信・予約は送られず、お知らせは消える。送ったメール・LINE は残る) */
  const remove = useCallback(async () => {
    try {
      const res = await deleteTrigger();
      revalidateDeliveries();
      const removed = res.removed.reduce((sum, item) => sum + item.removed, 0);
      showToast(`送信を削除しました(お知らせ ${removed} 件を削除し、未送信 ${res.canceledDeliveries} 件を止めました)`, "success");
    } catch (e) {
      showToast(err(e, "送信を削除できませんでした"), "error");
    }
  }, [deleteTrigger, revalidateDeliveries, showToast]);

  /** 失敗分を再送(送ったら includeUnknown を戻す) */
  const resend = useCallback(async () => {
    try {
      const res = await resendTrigger({ includeUnknown });
      revalidateDeliveries();
      setIncludeUnknown(false);
      showToast(
        res.mode === "new_dispatch"
          ? `新しい送信として ${res.failed + res.unknown} 件を送りました(送信一覧で確認できます)`
          : `${res.failed + res.unknown} 件を再送しました`,
        "success",
      );
    } catch (e) {
      showToast(err(e, "再送できませんでした"), "error");
    }
  }, [resendTrigger, includeUnknown, revalidateDeliveries, showToast]);

  /** 続きを送る(送信中の回を 1 束だけ進める) */
  const continueDispatch = useCallback(async () => {
    try {
      const res = await continueSending();
      revalidateDeliveries();
      showToast(res.completed ? "送信が完了しました" : `送信を再開しました(送信 ${res.sent} / 失敗 ${res.failed})`, "success");
    } catch (e) {
      showToast(err(e, "送信を再開できませんでした"), "error");
    }
  }, [continueSending, revalidateDeliveries, showToast]);

  return {
    dispatch,
    error,
    isLoading,
    deliveries,
    deliveryFilters: {
      status: deliveryStatus,
      setStatus: setDeliveryStatus,
      channel: deliveryChannel,
      setChannel: setDeliveryChannel,
    },
    includeUnknown,
    setIncludeUnknown,
    remove,
    resend,
    continueDispatch,
  };
}
