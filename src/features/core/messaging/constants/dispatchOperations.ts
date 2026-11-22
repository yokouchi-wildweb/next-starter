// src/features/core/messaging/constants/dispatchOperations.ts
//
// 送信の管理の操作(削除・失敗の再送・続きを送る、D88)ができない理由の符号と文。1 か所だけに置き、
// server の service(services/server/admin/operations.ts の 409 の文)と画面の部品(DispatchOperations の理由)が同じ物を読む。
// server を import しない(client の部品からも読むため)

/** 操作ができない理由の符号(AdminDispatchDetail.operations の reason と DomainError の code) */
export const DISPATCH_OPERATION_REASONS = [
  "not_found",
  "deleted",
  "cancelled",
  "scheduled",
  "not_processing",
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
  deleted: "削除した送信です",
  cancelled: "取り消された送信です",
  scheduled: "まだ送信していない予約です",
  not_processing: "送信中の送信ではありません",
  definition_missing: "この送信の設定を読み込めません",
  required: "受け取りを止められない必須の通知は再送できません",
  secret: "機密情報を含む通知は内容を保存しないため再送できません。元の操作からもう一度送信してください",
  no_failed: "再送する失敗した宛先がありません",
  no_input_copy: "本文が保存されていないため再送できません。新しく送信してください",
};

/** 送信の詳細で操作の上に出す状態の 1 行(D71 の言い方)。知らない状態は null */
export function dispatchStateLine(dispatch: { status: string; scheduledAt: string | null; deletedAt: string | null }): string | null {
  if (dispatch.deletedAt) return "この送信は削除済みです";
  switch (dispatch.status) {
    case "scheduled": {
      const at = dispatch.scheduledAt ? new Date(dispatch.scheduledAt) : null;
      if (!at || Number.isNaN(at.getTime())) return "この送信は予約中です";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `この送信は予約中です(${at.getMonth() + 1}/${at.getDate()} ${pad(at.getHours())}:${pad(at.getMinutes())} に送信)`;
    }
    case "processing":
      return "送信中です";
    case "completed":
      return "送信が完了しました";
    case "completed_with_failures":
      return "送信が完了しました(一部の宛先に送信できませんでした)";
    case "cancelled":
      return "この予約は取り消されました";
    default:
      return null;
  }
}
