"use client";

// src/features/core/messaging/services/client/inboxClient.ts
//
// 本人の受け取り箱の API(/api/me/messaging/inbox)。一覧はカーソル(続きの位置)で取る。
// 応答の形は @/hooks/cursorPage の CursorPage と同じ(useInfiniteScrollQuery のカーソルのモードにそのまま渡せる)

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type { InboxItemDto, InboxPage } from "@/features/core/messaging/services/server/inbox/dto";

const BASE = "/api/me/messaging/inbox";

export type { InboxItemDto, InboxPage };

export type ListInboxParams = {
  /** 続きの位置(前の応答の nextCursor)。null / 省略 = 先頭から */
  cursor?: string | null;
  /** 1 回の件数(1-50、サーバーの既定 20) */
  limit?: number;
  /** true = 未読だけ */
  unreadOnly?: boolean;
};

/** 本人の受け取り箱の一覧(公開の新しい順) */
export async function listInbox(params: ListInboxParams = {}): Promise<InboxPage> {
  try {
    const res = await axios.get<InboxPage>(BASE, {
      params: {
        cursor: params.cursor ?? undefined,
        limit: params.limit,
        unreadOnly: params.unreadOnly ? "true" : undefined,
      },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "お知らせの取得に失敗しました");
  }
}

/** 本人の未読の数 */
export async function getInboxUnreadCount(): Promise<number> {
  try {
    const res = await axios.get<{ count: number }>(`${BASE}/unread-count`);
    return res.data.count;
  } catch (error) {
    throw normalizeHttpError(error, "未読の数の取得に失敗しました");
  }
}

/** 1 件を既読にする(見えない行・知らない id は 404) */
export async function markInboxRead(id: string): Promise<void> {
  try {
    await axios.post(`${BASE}/${encodeURIComponent(id)}/read`);
  } catch (error) {
    throw normalizeHttpError(error, "既読にできませんでした");
  }
}

/** 全部を既読にする(今までに公開された行) */
export async function markAllInboxRead(): Promise<void> {
  try {
    await axios.post(`${BASE}/read-all`);
  } catch (error) {
    throw normalizeHttpError(error, "すべて既読にできませんでした");
  }
}
