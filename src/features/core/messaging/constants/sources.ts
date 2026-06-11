// src/features/messaging/constants/sources.ts
//
// source 識別子は「どの管理画面のどの操作から送信されたか」を示す。
// 命名規約: <画面/ドメイン>.<操作種別>（lower camelCase / dot 区切り）
//
// 新しい送信経路を追加するたびにこのファイルに定数を追加する。
// 型 MessagingSource は string なので呼び出し側は文字列リテラルでも渡せるが、
// 集約 & 検索しやすくするため必ずここから参照すること。

export const MESSAGING_SOURCES = {
  /** ユーザー管理ハブ詳細モーダルの「メッセージ送信」アクション */
  USER_HUB_DETAIL_SEND: "userHub.detail.send",
  /** 発送リクエスト一覧のバルクアクション「メール一斉送信」 */
  SHIPPING_REQUEST_BULK: "shippingRequest.bulk",
  /** 銀行振込レビュー一覧のバルクアクション「メール一斉送信」 */
  BANK_TRANSFER_REVIEW_BULK: "bankTransferReview.bulk",
} as const;

export type MessagingSource =
  (typeof MESSAGING_SOURCES)[keyof typeof MESSAGING_SOURCES];
