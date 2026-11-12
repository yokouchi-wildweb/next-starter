"use client";

// src/features/core/messaging/services/client/overrideClient.ts
//
// 管理画面の文言の上書きの API(/api/admin/messaging/overrides)。門 messagingOverrides が閉なら 404。
// 型は server の DTO(services/server/overrides/dto.ts)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  AdminOverrideField,
  AdminOverrideMessageDetail,
  AdminOverrideMessageSummary,
  SaveMessageOverrideInput,
} from "@/features/core/messaging/services/server/overrides/dto";

const BASE = "/api/admin/messaging/overrides";

export type { AdminOverrideField, AdminOverrideMessageDetail, AdminOverrideMessageSummary, SaveMessageOverrideInput };

/** 編集できる連絡の一覧(adminEditable を宣言した定義だけ。数は小さく固定) */
export async function listMessageOverrides(): Promise<AdminOverrideMessageSummary[]> {
  try {
    const res = await axios.get<{ items: AdminOverrideMessageSummary[] }>(BASE);
    return res.data.items;
  } catch (error) {
    throw normalizeHttpError(error, "文言の一覧の取得に失敗しました");
  }
}

/** 1 連絡の全欄(コードの値・管理画面の値・印・使ってよい {{鍵}}) */
export async function getMessageOverride(key: string): Promise<AdminOverrideMessageDetail> {
  try {
    const res = await axios.get<AdminOverrideMessageDetail>(`${BASE}/${encodeURIComponent(key)}`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "文言の取得に失敗しました");
  }
}

/** 欄 1 つを保存(送る口と同じ検査。誤りは 400) */
export async function saveMessageOverride(key: string, input: SaveMessageOverrideInput): Promise<AdminOverrideMessageDetail> {
  try {
    const res = await axios.put<AdminOverrideMessageDetail>(`${BASE}/${encodeURIComponent(key)}`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "文言を保存できませんでした");
  }
}

/** 欄 1 つを既定に戻す(行を消す) */
export async function resetMessageOverride(key: string, fieldPath: string): Promise<AdminOverrideMessageDetail> {
  try {
    const res = await axios.delete<AdminOverrideMessageDetail>(`${BASE}/${encodeURIComponent(key)}`, {
      params: { field: fieldPath },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "既定に戻せませんでした");
  }
}
