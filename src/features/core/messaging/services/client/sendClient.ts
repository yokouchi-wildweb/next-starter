"use client";

// src/features/core/messaging/services/client/sendClient.ts
//
// 管理の送る画面の API(/api/admin/messaging/send/**)。門 messagingBroadcast が閉なら 404。
// 型は server の入力(services/server/admin/send.ts)と描いたプレビュー・見込み(sendMessage/sender.ts)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  AdminSendEstimateInput,
  AdminSendInput,
  AdminSendOptions,
  AdminSendPreviewInput,
  AdminSendResult,
  AdminSendTestInput,
} from "@/features/core/messaging/services/server/admin/send";
import type { MessagePreview, RecipientEstimate } from "@/features/core/messaging/services/server/sendMessage/sender";

const BASE = "/api/admin/messaging/send";

export type {
  AdminSendEstimateInput,
  AdminSendInput,
  AdminSendOptions,
  AdminSendPreviewInput,
  AdminSendResult,
  AdminSendTestInput,
  MessagePreview,
  RecipientEstimate,
};

/** 送る(予約なら回を scheduled で作る) */
export async function adminSendMessage(input: AdminSendInput): Promise<AdminSendResult> {
  try {
    const res = await axios.post<AdminSendResult>(BASE, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送れませんでした");
  }
}

/** 描いたプレビュー(見本の受信者 = 操作した管理者) */
export async function previewAdminMessage(input: AdminSendPreviewInput): Promise<MessagePreview> {
  try {
    const res = await axios.post<MessagePreview>(`${BASE}/preview`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "プレビューを作れませんでした");
  }
}

/** 宛先数の見込み(送る時に確定し直す) */
export async function estimateAdminRecipients(input: AdminSendEstimateInput): Promise<RecipientEstimate> {
  try {
    const res = await axios.post<RecipientEstimate>(`${BASE}/estimate`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "宛先の数を見込めませんでした");
  }
}

/** 自分へのテスト送信(宛先 = 操作した管理者、テストの印) */
export async function sendAdminTestMessage(input: AdminSendTestInput): Promise<AdminSendResult> {
  try {
    const res = await axios.post<AdminSendResult>(`${BASE}/test`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テスト送信できませんでした");
  }
}

/** 送る画面の選択肢(経路・ロール・宛先の集め方・公開中のテンプレート・予約できる日数) */
export async function getAdminSendOptions(): Promise<AdminSendOptions> {
  try {
    const res = await axios.get<AdminSendOptions>(`${BASE}/options`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送る画面の選択肢を取得できませんでした");
  }
}
