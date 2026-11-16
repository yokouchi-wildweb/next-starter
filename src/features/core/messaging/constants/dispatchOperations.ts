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
  not_found: "送信が見つかりません",
  not_scheduled: "予約された送信ではありません",
  already_started: "すでに送信が始まっています",
  scheduled_use_cancel: "まだ送信していない予約は「予約を取り消す」を使ってください",
  cancelled: "取り消された送信です",
  retracted: "公開を停止した送信です",
  scheduled: "まだ送信していない予約です",
  definition_missing: "この送信の設定を読み込めません",
  required: "受け取りを止められない必須の通知は再送できません",
  secret: "機密情報を含む通知は内容を保存しないため再送できません。元の操作からもう一度送信してください",
  no_failed: "再送する失敗した宛先がありません",
  no_input_copy: "本文が保存されていないため再送できません。新しく送信してください",
};
