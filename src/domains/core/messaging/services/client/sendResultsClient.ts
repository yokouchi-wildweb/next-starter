"use client";

// src/domains/core/messaging/services/client/sendResultsClient.ts
//
// 管理の送る画面が送った後と 1 人宛ての時に読む材料の API(門の外、D214 (1)(2)):
// - GET /api/admin/messaging/send-results/[dispatchId] = 送信チャンネルごとの数 + 届かなかった人(カーソル)
// - GET /api/admin/messaging/recipients/[userId]/channels = 1 人の受け取れる送信チャンネル
// 型は server(services/server/admin/sendResults.ts・recipientChannels.ts)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  AdminRecipientChannels,
  RecipientChannelReason,
  RecipientChannelState,
} from "@/domains/core/messaging/services/server/admin/recipientChannels";
import type { AdminSendResultFailure, AdminSendResults } from "@/domains/core/messaging/services/server/admin/sendResults";

const BASE = "/api/admin/messaging";

/** 受け取れる送信チャンネルの条件: 連絡定義の鍵 / 自由連絡のカテゴリー / 無し(送信チャンネルの全部) */
export type RecipientChannelsQuery = { message: string } | { category: string } | Record<string, never>;

export type { AdminRecipientChannels, AdminSendResultFailure, AdminSendResults, RecipientChannelReason, RecipientChannelState };

/** 送信の結果(送信チャンネルごとの数はどのページにも、届かなかった人は古い順のカーソル) */
export async function getAdminSendResults(
  dispatchId: string,
  params: { cursor?: string | null; limit?: number } = {},
): Promise<AdminSendResults> {
  try {
    const res = await axios.get<AdminSendResults>(`${BASE}/send-results/${encodeURIComponent(dispatchId)}`, {
      params: { ...(params.cursor ? { cursor: params.cursor } : {}), ...(params.limit ? { limit: params.limit } : {}) },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送信の結果を取得できませんでした");
  }
}

/** 1 人の利用者の受け取れる送信チャンネル(見る送信チャンネルの順) */
export async function getAdminRecipientChannels(userId: string, query: RecipientChannelsQuery = {}): Promise<AdminRecipientChannels> {
  try {
    const res = await axios.get<AdminRecipientChannels>(`${BASE}/recipients/${encodeURIComponent(userId)}/channels`, { params: query });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "受け取れる送信チャンネルを取得できませんでした");
  }
}
