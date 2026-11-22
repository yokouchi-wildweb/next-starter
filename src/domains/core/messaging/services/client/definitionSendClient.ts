"use client";

// src/domains/core/messaging/services/client/definitionSendClient.ts
//
// 管理の定義連絡の送る口の API(/api/admin/messaging/definitions/**、D190 D214 (3))。
// 記録の入口と ?recordTarget= の選択肢は門の外、全員・ロール・グループの入口と ?entry=broadcast は門 messagingBroadcast(閉なら 404)。
// 型は server の入力・答え(services/server/admin/definitionSend.ts)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  AdminDefinitionEntry,
  AdminDefinitionOption,
  AdminDefinitionOptions,
  AdminDefinitionPreviewInput,
  AdminDefinitionSendInput,
  AdminDefinitionSendResult,
  AdminDefinitionTestInput,
} from "@/domains/core/messaging/services/server/admin/definitionSend";
import type { MessagePreview } from "@/domains/core/messaging/services/server/sendMessage/sender";

const BASE = "/api/admin/messaging/definitions";

/** 自分へのテスト送信の答え(afterSend は呼ばない) */
export type AdminDefinitionTestResult = Omit<AdminDefinitionSendResult, "afterSend">;

/** 選択肢の口の条件(どちらか 1 つ): 記録の入口の項目の鍵 / 全員・ロール・グループの入口 */
export type AdminDefinitionOptionsQuery = { recordTarget: string } | { entry: "broadcast" };

export type {
  AdminDefinitionEntry,
  AdminDefinitionOption,
  AdminDefinitionOptions,
  AdminDefinitionPreviewInput,
  AdminDefinitionSendInput,
  AdminDefinitionSendResult,
  AdminDefinitionTestInput,
};

/** 定義連絡を送る(全員・ロール・グループの入口は予約もできる) */
export async function sendAdminDefinition(input: AdminDefinitionSendInput): Promise<AdminDefinitionSendResult> {
  try {
    const res = await axios.post<AdminDefinitionSendResult>(`${BASE}/send`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送れませんでした");
  }
}

/** 描いたプレビュー(見本の受信者 = 操作した管理者、記録の入口は最初の記録の値) */
export async function previewAdminDefinition(input: AdminDefinitionPreviewInput): Promise<MessagePreview> {
  try {
    const res = await axios.post<MessagePreview>(`${BASE}/preview`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "プレビューを作れませんでした");
  }
}

/** 自分へのテスト送信(宛先 = 操作した管理者、テストの印) */
export async function sendAdminDefinitionTest(input: AdminDefinitionTestInput): Promise<AdminDefinitionTestResult> {
  try {
    const res = await axios.post<AdminDefinitionTestResult>(`${BASE}/test`, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テスト送信できませんでした");
  }
}

/** 定義連絡の選択肢(汎用の送るモーダルが組む材料) */
export async function getAdminDefinitionOptions(query: AdminDefinitionOptionsQuery): Promise<AdminDefinitionOptions> {
  try {
    const res = await axios.get<AdminDefinitionOptions>(`${BASE}/options`, { params: query });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "送る連絡の選択肢を取得できませんでした");
  }
}
