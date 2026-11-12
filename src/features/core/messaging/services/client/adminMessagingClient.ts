"use client";

// src/features/core/messaging/services/client/adminMessagingClient.ts
//
// 管理の送信と回の読む口の API(/api/admin/messaging/**)。一覧と配達はカーソル(続きの位置)で取る。
// 応答の形は @/hooks/cursorPage の CursorPage と同じ(useInfiniteScrollQuery のカーソルのモードにそのまま渡せる)。
// 型は server の DTO(D37)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  AdminBulkSendInput,
  AdminBulkSendResult,
} from "@/features/core/messaging/services/server/admin/bulkSend";
import type {
  AdminDeliveryRow,
  AdminDispatchDetail,
  AdminDispatchSummary,
} from "@/features/core/messaging/services/server/admin/dispatchDto";
import type {
  AdminCancelResult,
  AdminResendResult,
  AdminRetractResult,
} from "@/features/core/messaging/services/server/admin/operations";
import type { ContinueSendingResult } from "@/features/core/messaging/services/server/sweep/sweep";

const BASE = "/api/admin/messaging";

export type {
  AdminBulkSendInput,
  AdminBulkSendResult,
  AdminCancelResult,
  AdminDeliveryRow,
  AdminDispatchDetail,
  AdminDispatchSummary,
  AdminResendResult,
  AdminRetractResult,
  ContinueSendingResult,
};

/** カーソルで取る 1 回分(CursorPage と同じ形) */
export type AdminCursorPage<T> = { items: T[]; nextCursor: string | null };

/** 回の一覧の絞り込み(どれも省略可) */
export type AdminDispatchFilters = {
  /** 作った時刻の下限(ISO か YYYY-MM-DD、以上) */
  from?: string;
  /** 作った時刻の上限(未満) */
  to?: string;
  messageKey?: string;
  kind?: "transactional" | "marketing" | "activity";
  channel?: string;
  status?: string;
};

/** 配達の絞り込み */
export type AdminDeliveryFilters = {
  status?: string;
  channel?: string;
};

type CursorParams = { cursor?: string | null; limit?: number };

/** 空の値を query に載せない */
function compact(params: Record<string, string | number | null | undefined>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

/** 管理の一括送信(連絡 messaging.adminMessage) */
export async function adminBulkSend(input: AdminBulkSendInput): Promise<AdminBulkSendResult> {
  try {
    const res = await axios.post<AdminBulkSendResult>(`${BASE}/bulk-send`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "一括送信に失敗しました");
  }
}

/** 回の一覧(新しい順) */
export async function listAdminDispatches(
  params: AdminDispatchFilters & CursorParams = {},
): Promise<AdminCursorPage<AdminDispatchSummary>> {
  try {
    const res = await axios.get<AdminCursorPage<AdminDispatchSummary>>(`${BASE}/dispatches`, {
      params: compact({ ...params, cursor: params.cursor ?? undefined }),
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送信の一覧の取得に失敗しました");
  }
}

/** 回 1 件 */
export async function getAdminDispatch(id: string): Promise<AdminDispatchDetail> {
  try {
    const res = await axios.get<AdminDispatchDetail>(`${BASE}/dispatches/${encodeURIComponent(id)}`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送信の取得に失敗しました");
  }
}

/** 回の配達(作った順、keyset) */
export async function listAdminDispatchDeliveries(
  id: string,
  params: AdminDeliveryFilters & CursorParams = {},
): Promise<AdminCursorPage<AdminDeliveryRow>> {
  try {
    const res = await axios.get<AdminCursorPage<AdminDeliveryRow>>(
      `${BASE}/dispatches/${encodeURIComponent(id)}/deliveries`,
      { params: compact({ ...params, cursor: params.cursor ?? undefined }) },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "配達の一覧の取得に失敗しました");
  }
}

/** 回を 1 束だけ進める(続きを送る。processing の回だけ) */
export async function continueAdminDispatch(id: string): Promise<ContinueSendingResult> {
  try {
    const res = await axios.post<ContinueSendingResult>(`${BASE}/dispatches/${encodeURIComponent(id)}/continue`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "続きを送れませんでした");
  }
}

/** 予約の取り消し(予約でまだ展開していない回だけ。他は 409) */
export async function cancelAdminDispatch(id: string): Promise<AdminCancelResult> {
  try {
    const res = await axios.post<AdminCancelResult>(`${BASE}/dispatches/${encodeURIComponent(id)}/cancel`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "予約を取り消せませんでした");
  }
}

/** 取り下げ(お知らせの行を消し、未送信の配達を止める。戻せない。送ったメールは取り戻せない) */
export async function retractAdminDispatch(id: string): Promise<AdminRetractResult> {
  try {
    const res = await axios.post<AdminRetractResult>(`${BASE}/dispatches/${encodeURIComponent(id)}/retract`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "取り下げられませんでした");
  }
}

/** 失敗の再送(includeUnknown = 送れたか分からない宛先も含める。二重の可能性を回に残す) */
export async function resendAdminDispatch(id: string, input: { includeUnknown?: boolean } = {}): Promise<AdminResendResult> {
  try {
    const res = await axios.post<AdminResendResult>(`${BASE}/dispatches/${encodeURIComponent(id)}/resend`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送り直せませんでした");
  }
}
