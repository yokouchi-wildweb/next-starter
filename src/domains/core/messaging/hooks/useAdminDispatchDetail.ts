"use client";

// src/domains/core/messaging/hooks/useAdminDispatchDetail.ts
//
// 管理: 送信 1 件の画面の流れ(AdminDispatchDetail はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui)。
// - 送信 1 件(useAdminDispatch)と配達の一覧(状態・送信チャンネルで絞る、useAdminDispatchDeliveries)
// - 送信のプレビュー(送信の中身 content がある送信だけ。GET dispatches/[id]/preview: 送信のレイアウトと欄の中身を送信の値で差し込み、
//   メールは送った描き方の HTML、お知らせはレイアウトの描き方の材料)。送信チャンネルのタブの値と選んだ送信チャンネルの描く物を部品 LayoutPreview の形で返す
// - 送信の操作: 削除(D88)・失敗分を再送(includeUnknown = 届いたか分からない分も)・続きを送る
//   どれも成功したら配達を取り直して知らせ(toast)を出し、失敗は知らせだけ(Promise は ConfirmPopover の loading 用に返す)

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";

import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { getAdminDispatchPreview, type AdminDispatchPreview } from "../services/client/adminMessagingClient";

import type { LayoutPreviewContent } from "../components/common/LayoutPreview";

import { adminDispatchKey } from "./adminMessagingKeys";
import { useAdminDispatch } from "./useAdminDispatch";
import { useAdminDispatchDeliveries } from "./useAdminDispatchDeliveries";
import { useContinueDispatch } from "./useContinueDispatch";
import { useDeleteDispatch } from "./useDeleteDispatch";
import { useDispatchDeleteSummary } from "./useDispatchDeleteSummary";
import { useResendDispatch } from "./useResendDispatch";

export type UseAdminDispatchDetailOptions = {
  /** 配達の 1 回の件数(既定 50、最大 100) */
  limit?: number;
  observerOptions?: IntersectionObserverInit;
  /** 削除が通った後(送信の詳細のモーダルは閉じて一覧を取り直す) */
  onDeleted?: () => void;
};

export function useAdminDispatchDetail(dispatchId: string, options: UseAdminDispatchDetailOptions = {}) {
  const { onDeleted } = options;
  const { showToast } = useToast();
  const { dispatch, error, isLoading } = useAdminDispatch(dispatchId);
  // 送信の中身(レイアウトと欄の中身)を残した送信だけプレビューを取る
  const hasContent = Boolean(dispatch?.content);
  const previewQuery = useSWR<AdminDispatchPreview>(hasContent ? `${adminDispatchKey(dispatchId)}/preview` : null, () =>
    getAdminDispatchPreview(dispatchId),
  );
  const previewData = previewQuery.data;
  const [previewChannelState, setPreviewChannel] = useState<string | null>(null);
  const previewChannels = useMemo(() => (previewData?.channels ?? []).map((channel) => channel.key), [previewData]);
  const previewChannel =
    previewChannelState && previewChannels.includes(previewChannelState) ? previewChannelState : (previewChannels[0] ?? null);
  /** 選んだ送信チャンネルの描く物(部品 LayoutPreview の content) */
  const previewContent = useMemo<LayoutPreviewContent | null>(() => {
    const found = previewData?.channels.find((channel) => channel.key === previewChannel);
    if (!found) return null;
    return {
      html: found.html,
      text: found.text,
      title: found.summary?.title ?? null,
      values: found.values,
      summary: found.summary,
      cannotRender: found.cannotRender,
    };
  }, [previewData, previewChannel]);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("");
  const [includeUnknown, setIncludeUnknown] = useState(false);
  // 削除の確認を開いている間だけ見込みを取る(D88)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteSummary = useDispatchDeleteSummary([dispatchId], deleteConfirmOpen);
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
      showToast(`送信を削除しました(サービス内通知 ${removed} 件を削除し、未送信 ${res.canceledDeliveries} 件を止めました)`, "success");
      onDeleted?.();
    } catch (e) {
      showToast(err(e, "送信を削除できませんでした"), "error");
    }
  }, [deleteTrigger, revalidateDeliveries, showToast, onDeleted]);

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

  /** 続きを送る(送信中のものを 1 束だけ進める) */
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
    /** 送信のプレビュー(送信の中身がある送信だけ。中身の無い送信は null = 前の本文の見せ方) */
    preview: hasContent
      ? {
          /** レイアウトの鍵(送信ごと描けなければ null) */
          layout: previewData?.layout ?? null,
          channels: previewChannels,
          channel: previewChannel,
          setChannel: setPreviewChannel,
          content: previewContent,
          /** 送信ごと描けない理由(中身を残していない送信など) */
          cannotRender: previewData?.cannotRender ?? null,
          error: previewQuery.error ?? null,
          isLoading: previewQuery.isLoading,
        }
      : null,
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
    /** 削除の見込み(確認の Dialog に出す) */
    deleteSummary: deleteSummary.summary,
    deleteSummaryLoading: deleteSummary.isLoading,
    deleteSummaryError: deleteSummary.error,
    setDeleteConfirmOpen,
    resend,
    continueDispatch,
  };
}
