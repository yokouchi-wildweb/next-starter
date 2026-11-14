"use client";

// src/features/core/messaging/hooks/useAdminDispatchDetail.ts
//
// 管理: 送った回 1 件の画面の流れ(AdminDispatchDetail はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui)。
// - 回 1 件(useAdminDispatch)と配達の一覧(状態・経路で絞る、useAdminDispatchDeliveries)
// - 回の操作: 予約を取り消す・取り下げる・失敗分を再送(includeUnknown = 届いたか分からない分も)・続きを送る
//   どれも成功したら配達を取り直して知らせ(toast)を出し、失敗は知らせだけ(Promise は ConfirmPopover の loading 用に返す)

import { useCallback, useState } from "react";

import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { useAdminDispatch } from "./useAdminDispatch";
import { useAdminDispatchDeliveries } from "./useAdminDispatchDeliveries";
import { useCancelDispatch } from "./useCancelDispatch";
import { useContinueDispatch } from "./useContinueDispatch";
import { useResendDispatch } from "./useResendDispatch";
import { useRetractDispatch } from "./useRetractDispatch";

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
  const { trigger: cancelTrigger } = useCancelDispatch(dispatchId);
  const { trigger: retractTrigger } = useRetractDispatch(dispatchId);
  const { trigger: resendTrigger } = useResendDispatch(dispatchId);

  /** 予約を取り消す */
  const cancel = useCallback(async () => {
    try {
      await cancelTrigger();
      revalidateDeliveries();
      showToast("予約を取り消しました", "success");
    } catch (e) {
      showToast(err(e, "予約を取り消せませんでした"), "error");
    }
  }, [cancelTrigger, revalidateDeliveries, showToast]);

  /** 取り下げる(お知らせを消し、まだの配達を止める) */
  const retract = useCallback(async () => {
    try {
      const res = await retractTrigger();
      revalidateDeliveries();
      showToast(`取り下げました(お知らせ ${res.deletedInboxItems} 件を消し、配達 ${res.canceledDeliveries} 件を止めました)`, "success");
    } catch (e) {
      showToast(err(e, "取り下げられませんでした"), "error");
    }
  }, [retractTrigger, revalidateDeliveries, showToast]);

  /** 失敗分を再送(送ったら includeUnknown を戻す) */
  const resend = useCallback(async () => {
    try {
      const res = await resendTrigger({ includeUnknown });
      revalidateDeliveries();
      setIncludeUnknown(false);
      showToast(
        res.mode === "new_dispatch"
          ? `新しい回として ${res.failed + res.unknown} 件を送りました(回の一覧から見られます)`
          : `${res.failed + res.unknown} 件を送り直しました`,
        "success",
      );
    } catch (e) {
      showToast(err(e, "送り直せませんでした"), "error");
    }
  }, [resendTrigger, includeUnknown, revalidateDeliveries, showToast]);

  /** 続きを送る(送信中の回を 1 束だけ進める) */
  const continueDispatch = useCallback(async () => {
    try {
      const res = await continueSending();
      revalidateDeliveries();
      showToast(res.completed ? "送信を終えました" : `続きを送りました(送信 ${res.sent} / 失敗 ${res.failed})`, "success");
    } catch (e) {
      showToast(err(e, "続きを送れませんでした"), "error");
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
    cancel,
    retract,
    resend,
    continueDispatch,
  };
}
