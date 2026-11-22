"use client";

// src/domains/core/messaging/hooks/useScheduledEditOptions.ts
//
// 公開の hook: 予約した送信の直しの材料(GET /api/admin/messaging/dispatches/[id]/edit-options、門 messagingDispatches)。
// レイアウト(今の版)・直せる欄・今の欄の中身・送信チャンネルごとの固定(on / off / free)・予約できる日数の上限。
// 時刻だけ直せる送信も 200 で答える(layout・values が null、channels が空)。予約のままでない送信は 409 = error
// useScheduledEdit がモーダルを開いている間だけ読む(enabled)

import useSWR from "swr";

import { getAdminDispatchEditOptions } from "../services/client/adminMessagingClient";
import type { AdminScheduledEditOptions } from "../services/server/admin/scheduledEdit";
import { scheduledEditOptionsKey } from "./messagingKeys";

/** 直しの材料のキー(保存の後に送信 1 件のキーと一緒に読み直す) */

export function useScheduledEditOptions(dispatchId: string, enabled = true) {
  const query = useSWR<AdminScheduledEditOptions>(enabled ? scheduledEditOptionsKey(dispatchId) : null, () =>
    getAdminDispatchEditOptions(dispatchId),
  );
  return { options: query.data ?? null, error: query.error ?? null, isLoading: query.isLoading };
}
