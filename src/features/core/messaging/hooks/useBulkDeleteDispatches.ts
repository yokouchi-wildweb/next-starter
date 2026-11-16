"use client";

// src/features/core/messaging/hooks/useBulkDeleteDispatches.ts
//
// 管理: 回のまとめての削除(D88、POST /dispatches/bulk-delete、1 回 100 件まで)。結果は知らせ(削除 N 件・できなかった M 件)。
// 一括操作の項目 adminBulkActions/delete.tsx が使う(一覧の取り直しは項目の onDone = 入れ物)

import { useCallback } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import { bulkDeleteAdminDispatches, type AdminBulkDeleteResult } from "../services/client/adminMessagingClient";

import { ADMIN_DISPATCHES_KEY } from "./adminMessagingKeys";

/** 1 回に削除できる回の数(サーバーの ADMIN_DELETE_MAX_IDS と同じ) */
export const DISPATCH_DELETE_MAX = 100;

export function useBulkDeleteDispatches() {
  const { showToast } = useToast();
  const mutation = useDomainMutation<AdminBulkDeleteResult, readonly string[]>(
    `${ADMIN_DISPATCHES_KEY}/bulk-delete`,
    (ids) => bulkDeleteAdminDispatches(ids),
    [ADMIN_DISPATCHES_KEY],
  );
  /** 削除する(成功した回の id を返す。失敗は知らせて空) */
  const remove = useCallback(
    async (ids: readonly string[]): Promise<string[]> => {
      try {
        const res = await mutation.trigger(ids);
        const done = res.results.filter((item) => item.ok).map((item) => item.dispatchId);
        const failed = res.results.length - done.length;
        showToast(
          failed > 0 ? `${done.length} 件を削除しました(${failed} 件は削除できませんでした)` : `${done.length} 件を削除しました`,
          failed > 0 ? "warning" : "success",
        );
        return done;
      } catch (e) {
        showToast(err(e, "送信を削除できませんでした"), "error");
        return [];
      }
    },
    [mutation, showToast],
  );
  return { remove, isMutating: mutation.isMutating };
}
