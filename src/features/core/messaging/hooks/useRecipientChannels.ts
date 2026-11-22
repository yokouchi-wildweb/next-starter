"use client";

// src/features/core/messaging/hooks/useRecipientChannels.ts
//
// 1 人の利用者の受け取れる送信チャンネル(公開の部品、D191 D214 (2))。1 人宛ての送る画面が出す情報だけ
// (届かない送信チャンネルを選べなくする等の見せ方は画面と fork が決める)。条件 = 連絡定義の鍵 / 自由連絡のカテゴリー / 無し

import useSWR from "swr";

import {
  getAdminRecipientChannels,
  type AdminRecipientChannels,
  type RecipientChannelsQuery,
} from "../services/client/sendResultsClient";

import { recipientChannelsKey } from "./sendKeys";

/** userId = 宛先の利用者(null = 取らない) */
export function useRecipientChannels(userId: string | null, query: RecipientChannelsQuery = {}, enabled = true) {
  const { data, error, isLoading } = useSWR<AdminRecipientChannels>(
    enabled && userId ? recipientChannelsKey(userId, query) : null,
    () => getAdminRecipientChannels(userId as string, query),
  );
  return { channels: data ?? null, error, isLoading };
}
