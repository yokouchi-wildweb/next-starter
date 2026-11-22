"use client";

// src/domains/core/messaging/services/client/userHistoryClient.ts
//
// 利用者ごとの連絡の履歴の API(D37・D215、門の外 = 送信の管理画面を閉じても読める):
// - GET /api/admin/messaging/users/[userId]/history?cursor&limit = 配達と、その利用者の受け取り箱に見える全員・ロール宛ての
//   共有のお知らせ(type "sharedInApp"、配達の状態なし)を時刻の新しい順に 1 本で(カーソル)
// 型は server(services/server/history/dto.ts)を型だけ読む。形: services/server/history/README.md

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type { UserMessageHistoryItem } from "@/domains/core/messaging/services/server/history/dto";

const BASE = "/api/admin/messaging";

export type { UserMessageHistoryItem };

/** 利用者ごとの履歴の 1 ページ */
export type UserMessageHistoryPage = { items: UserMessageHistoryItem[]; nextCursor: string | null };

/** 1 人の利用者の連絡の履歴(時刻の新しい順、カーソル。limit 既定 50、最大 100)。居ない利用者は 404 */
export async function getAdminUserMessageHistory(
  userId: string,
  params: { cursor?: string | null; limit?: number } = {},
): Promise<UserMessageHistoryPage> {
  try {
    const res = await axios.get<UserMessageHistoryPage>(`${BASE}/users/${encodeURIComponent(userId)}/history`, {
      params: { ...(params.cursor ? { cursor: params.cursor } : {}), ...(params.limit ? { limit: params.limit } : {}) },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "連絡の履歴を取得できませんでした");
  }
}
