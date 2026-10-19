// src/features/core/notification/hooks/useSendNotification.ts
// 管理者のお知らせ送信フック

"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import {
  sendNotification,
  type SendNotificationInput,
} from "../services/client/userNotificationClient";

/**
 * お知らせを送信（予約）する。成功時は管理一覧（notifications）のキャッシュを再検証する。
 * 返り値は他の mutation フックと同じ { trigger, isMutating, isLoading, error }。
 */
export const useSendNotification = () =>
  useDomainMutation<void, SendNotificationInput>(
    "notifications/send",
    sendNotification,
    "notifications",
  );
