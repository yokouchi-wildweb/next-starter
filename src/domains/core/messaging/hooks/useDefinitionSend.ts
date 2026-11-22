"use client";

// src/domains/core/messaging/hooks/useDefinitionSend.ts
//
// 定義連絡の送る口の hook(公開の部品、D191。汎用の送るモーダルと fork の自前の送る画面が組む):
// - useDefinitionSendOptions(query, enabled): 選択肢(SWR。記録の入口 = 項目の鍵 / 全員・ロール・グループ = entry broadcast)
// - useDefinitionSend(): 送る(mutation。送ったら送信の一覧を再検証)。二重送信の鍵は呼び手が useIdempotencyKey で持って渡す
// - useDefinitionPreview() / useDefinitionTest(): 汎用の useSendPreview / useSendTest を定義連絡の口でつないだ物

import useSWR from "swr";

import { useDomainMutation } from "@/lib/crud";

import {
  getAdminDefinitionOptions,
  previewAdminDefinition,
  sendAdminDefinition,
  sendAdminDefinitionTest,
  type AdminDefinitionOptions,
  type AdminDefinitionOptionsQuery,
  type AdminDefinitionPreviewInput,
  type AdminDefinitionSendInput,
  type AdminDefinitionSendResult,
} from "../services/client/definitionSendClient";

import { useSendPreview } from "./useSendPreview";
import { useSendTest } from "./useSendTest";
import { ADMIN_DEFINITION_SEND_SEND_KEY, ADMIN_DISPATCHES_KEY, definitionOptionsKey } from "./messagingKeys";

/** 定義連絡の選択肢(enabled の間だけ取る = 送る画面が開いている間) */
export function useDefinitionSendOptions(query: AdminDefinitionOptionsQuery, enabled = true) {
  const { data, error, isLoading } = useSWR<AdminDefinitionOptions>(enabled ? definitionOptionsKey(query) : null, () =>
    getAdminDefinitionOptions(query),
  );
  return { options: data ?? null, error, isLoading };
}

/** 定義連絡を送る(誤りは投げる。409 = 同じ鍵で送り済み) */
export function useDefinitionSend() {
  const mutation = useDomainMutation<AdminDefinitionSendResult, AdminDefinitionSendInput>(
    ADMIN_DEFINITION_SEND_SEND_KEY,
    sendAdminDefinition,
    [ADMIN_DISPATCHES_KEY],
  );
  return { send: mutation.trigger, isSending: mutation.isMutating };
}

/** 定義連絡の「あなた宛ての表示例」(見本の受信者 = 操作した管理者、記録の入口は最初の記録の値) */
export function useDefinitionPreview() {
  return useSendPreview({ fetcher: (input: AdminDefinitionPreviewInput) => previewAdminDefinition(input), name: "definitions/preview" });
}

/** 定義連絡の自分へのテスト送信(毎回新しい鍵) */
export function useDefinitionTest() {
  return useSendTest({ fetcher: sendAdminDefinitionTest, name: "definitions/test" });
}
