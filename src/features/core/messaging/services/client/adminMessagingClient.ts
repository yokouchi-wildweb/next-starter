"use client";

// src/features/core/messaging/services/client/adminMessagingClient.ts
//
// 管理の送信と回の読む口の API(/api/admin/messaging/**)。一覧と配達はカーソル(続きの位置)で取る。
// 応答の形は @/hooks/cursorPage の CursorPage と同じ(useInfiniteScrollQuery のカーソルのモードにそのまま渡せる)。
// 型は server の DTO(D37)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { MessageKind } from "@/lib/messaging";

import type {
  AdminBulkSendInput,
  AdminBulkSendOptions,
  AdminBulkSendResult,
} from "@/features/core/messaging/services/server/admin/bulkSend";
import type { AdminFreeTextCategoryOption } from "@/features/core/messaging/services/server/admin/freeText";
import type {
  AdminDeliveryRow,
  AdminDispatchDetail,
  AdminDispatchPreview,
  AdminDispatchPreviewChannel,
  AdminDispatchSummary,
} from "@/features/core/messaging/services/server/admin/dispatchDto";
import type {
  AdminBulkDeleteResult,
  AdminDeleteResult,
  AdminDeleteSummary,
  AdminResendResult,
} from "@/features/core/messaging/services/server/admin/operations";
import type {
  AdminSendPreviewInput,
  AdminSendResult,
  AdminSendTestInput,
} from "@/features/core/messaging/services/server/admin/send";
import type { AdminDispatchCategoryOption } from "@/features/core/messaging/services/server/admin/readDispatches";
import type { MessagePreview } from "@/features/core/messaging/services/server/sendMessage/sender";
import type { ContinueSendingResult } from "@/features/core/messaging/services/server/sweep/sweep";

const BASE = "/api/admin/messaging";

export type {
  AdminBulkSendInput,
  AdminBulkSendOptions,
  AdminBulkSendResult,
  AdminFreeTextCategoryOption,
  AdminBulkDeleteResult,
  AdminDeleteResult,
  AdminDeleteSummary,
  AdminDeliveryRow,
  AdminDispatchCategoryOption,
  AdminDispatchDetail,
  AdminDispatchPreview,
  AdminDispatchPreviewChannel,
  AdminDispatchSummary,
  AdminResendResult,
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
  /** 種別(7 つ、lib/messaging の MESSAGE_KINDS) */
  kind?: MessageKind;
  /** カテゴリーの鍵(選択肢は getAdminDispatchCategories。定義の鍵では絞らない、D46) */
  category?: string;
  channel?: string;
  status?: string;
  /** 削除した回: exclude = 出さない(既定)/ only = 削除した回だけ / include = 両方(D88) */
  deleted?: "exclude" | "only" | "include";
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

/** 一括送信の選択肢(一覧の一括で送れるカテゴリー) */
export async function getAdminBulkSendOptions(): Promise<AdminBulkSendOptions> {
  try {
    const res = await axios.get<AdminBulkSendOptions>(`${BASE}/bulk-send`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "一括送信の選択肢の取得に失敗しました");
  }
}

/** 管理の一括送信(白紙か DB のテンプレート + 欄の中身。body の category は必須) */
/** 一括送信のプレビュー(送る画面と同じ中身。門 messagingBroadcast の外) */
export async function previewAdminBulkMessage(input: AdminSendPreviewInput): Promise<MessagePreview> {
  try {
    const res = await axios.post<MessagePreview>(`${BASE}/bulk-send/preview`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "プレビューを作れませんでした");
  }
}

/** 一括送信の自分へのテスト送信(宛先 = 操作した管理者。門 messagingBroadcast の外) */
export async function sendAdminBulkTestMessage(input: AdminSendTestInput): Promise<AdminSendResult> {
  try {
    const res = await axios.post<AdminSendResult>(`${BASE}/bulk-send/test`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テスト送信できませんでした");
  }
}

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

/** 回の画面の絞りの選択肢(カテゴリーの鍵・表示名・種別) */
export async function getAdminDispatchCategories(): Promise<AdminDispatchCategoryOption[]> {
  try {
    const res = await axios.get<{ items: AdminDispatchCategoryOption[] }>(`${BASE}/dispatches/categories`);
    return res.data.items;
  } catch (error) {
    throw normalizeHttpError(error, "カテゴリーの一覧の取得に失敗しました");
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

/** 送った回のプレビュー(回のひな形と欄の中身を回の値で描く。メールの HTML・お知らせの描き方の材料) */
export async function getAdminDispatchPreview(id: string): Promise<AdminDispatchPreview> {
  try {
    const res = await axios.get<AdminDispatchPreview>(`${BASE}/dispatches/${encodeURIComponent(id)}/preview`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送信のプレビューの取得に失敗しました");
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

/** 回の削除(D88、どの状態でも。未送信・予約は送られず、お知らせは消える。送ったメール・LINE は残る。戻せない) */
export async function deleteAdminDispatch(id: string): Promise<AdminDeleteResult> {
  try {
    const res = await axios.delete<AdminDeleteResult>(`${BASE}/dispatches/${encodeURIComponent(id)}`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送信を削除できませんでした");
  }
}

/** 回のまとめての削除(1〜100 件、回ごとの結果) */
export async function bulkDeleteAdminDispatches(ids: readonly string[]): Promise<AdminBulkDeleteResult> {
  try {
    const res = await axios.post<AdminBulkDeleteResult>(`${BASE}/dispatches/bulk-delete`, { ids });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送信を削除できませんでした");
  }
}

/** 削除の見込み(確認の画面。経路ごとの送れた数・消せるか・未送信・予約の数) */
export async function adminDispatchDeleteSummary(ids: readonly string[]): Promise<AdminDeleteSummary> {
  try {
    const res = await axios.post<AdminDeleteSummary>(`${BASE}/dispatches/delete-summary`, { ids });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "削除の見込みを読み込めませんでした");
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
