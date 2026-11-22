"use client";

// src/domains/core/messaging/services/client/dispatchReadersClient.ts
//
// 送信の詳細の既読した利用者の一覧の API(D210、門 messagingDispatches):
// - GET /api/admin/messaging/dispatches/[id]/readers?cursor&limit = 時刻のある既読を既読の新しい順(カーソル)
// 型は server(services/server/admin/dispatchReaders.ts)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type { DispatchReader } from "@/domains/core/messaging/services/server/admin/dispatchReaders";

const BASE = "/api/admin/messaging";

export type { DispatchReader };

/** 既読した利用者の 1 ページ */
export type DispatchReadersPage = { items: DispatchReader[]; nextCursor: string | null };

/** 送信 1 つの既読した利用者(既読の新しい順、カーソル。limit 既定 50、最大 100) */
export async function getAdminDispatchReaders(
  dispatchId: string,
  params: { cursor?: string | null; limit?: number } = {},
): Promise<DispatchReadersPage> {
  try {
    const res = await axios.get<DispatchReadersPage>(`${BASE}/dispatches/${encodeURIComponent(dispatchId)}/readers`, {
      params: { ...(params.cursor ? { cursor: params.cursor } : {}), ...(params.limit ? { limit: params.limit } : {}) },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "既読した利用者を取得できませんでした");
  }
}
