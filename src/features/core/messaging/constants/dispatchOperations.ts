// src/features/core/messaging/constants/dispatchOperations.ts
//
// 回の管理の操作(予約の取り消し・取り下げ・失敗の再送)ができない理由の符号と文。1 か所だけに置き、
// server の service(services/server/admin/operations.ts の 409 の文)と画面の部品(DispatchOperations の理由)が同じ物を読む。
// server を import しない(client の部品からも読むため)

/** 操作ができない理由の符号(AdminDispatchDetail.operations の reason と DomainError の code) */
export const DISPATCH_OPERATION_REASONS = [
  "not_found",
  "not_scheduled",
  "already_started",
  "scheduled_use_cancel",
  "cancelled",
  "retracted",
  "scheduled",
  "definition_missing",
  "required",
  "secret",
  "no_failed",
  "no_input_copy",
] as const;

export type DispatchOperationReason = (typeof DISPATCH_OPERATION_REASONS)[number];

/** 理由の文(409 の文と画面の理由の行) */
export const DISPATCH_OPERATION_REASON_TEXT: Record<DispatchOperationReason, string> = {
  not_found: "回がありません",
  not_scheduled: "予約の回ではありません",
  already_started: "もう送り始めています",
  scheduled_use_cancel: "まだ送っていない予約の回は取り消しを使ってください",
  cancelled: "取り消した回です",
  retracted: "取り下げた回です",
  scheduled: "まだ送っていない予約の回です",
  definition_missing: "回の連絡の定義を読めません",
  required: "止められない連絡(required)は送り直せません",
  secret: "秘密の値を差し込む連絡は秘密を残さないので送り直せません。送り手の処理からもう一度送ってください",
  no_failed: "送り直す失敗の宛先がありません",
  no_input_copy: "本文を残さない連絡で、元の入力の写しがもう無いので送り直せません。新しい回として送ってください",
};
