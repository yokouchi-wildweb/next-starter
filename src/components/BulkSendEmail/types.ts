// src/components/BulkSendEmail/types.ts
//
// バルクアクション「メール一斉送信」（複数レコード選択 → 紐づくユーザーへ
// メール + 任意のサービス内お知らせ通知）の共通データ契約。
// 汎用 BulkSendEmailButton と各ドメインのクライアントサービスが参照する。

/** 一斉送信の入力（選択レコード ID + メール／通知内容） */
export type BulkSendEmailInput = {
  /** 送信対象レコードの ID 配列（管理画面で選択された全件） */
  ids: string[];
  /** メール件名（必須・自由入力） */
  emailSubject: string;
  /** メール本文（必須・プレーンテキスト・自由入力） */
  emailBody: string;
  /** サービス内お知らせ通知も発行するか */
  sendNotification: boolean;
  /** 通知タイトル（sendNotification=true のとき必須） */
  notificationTitle?: string;
  /** 通知本文（sendNotification=true のとき必須） */
  notificationBody?: string;
};

/** メール送信失敗時の詳細 */
export type BulkSendEmailFailure = {
  userId: string;
  email: string | null;
  reason: string;
};

/** 一斉送信の結果 */
export type BulkSendEmailResult = {
  /** 重複排除後の送信対象ユーザー数 */
  targetUserCount: number;
  /** メール送信成功件数 */
  emailSentCount: number;
  /** メール送信失敗件数 */
  emailFailedCount: number;
  /** メール送信失敗の詳細 */
  emailFailures: BulkSendEmailFailure[];
  /** お知らせ通知が発行されたか（sendNotification=false のときは null） */
  notificationCreated: boolean | null;
  /** admin_memo に送信記録を追記したレコード件数 */
  memoAppendedCount: number;
};
