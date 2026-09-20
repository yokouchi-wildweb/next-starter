// src/features/messaging/constants/sources.ts
//
// source 識別子は「どの送信経路から送信されたか」を示す。
// 管理画面の操作が起点のもの（<画面>.<操作種別>）と、cron 等のシステムが起点のもの
// （<ドメイン>.<機能>.<通知種別>）がある。
// 命名規約: lower camelCase / dot 区切り
//
// 新しい送信経路を追加するたびにこのファイルに定数を追加する。
// 型 MessagingSource は string なので呼び出し側は文字列リテラルでも渡せるが、
// 集約 & 検索しやすくするため必ずここから参照すること。

export const MESSAGING_SOURCES = {
  /**
   * ユーザー管理ハブ詳細モーダルの「メッセージ送信」アクション。
   * 本テンプレートに該当画面は無い（ダウンストリームプロジェクトで使用する送信経路の例
   * として残している。削除するとダウンストリーム側のマージで衝突・ビルドエラーになるため維持）。
   */
  USER_HUB_DETAIL_SEND: "userHub.detail.send",
  /**
   * 発送リクエスト一覧のバルクアクション「メール一斉送信」。
   * 本テンプレートに該当画面は無い（同上、ダウンストリーム向けに維持）。
   */
  SHIPPING_REQUEST_BULK: "shippingRequest.bulk",
  /** 銀行振込レビュー一覧のバルクアクション「メール一斉送信」 */
  BANK_TRANSFER_REVIEW_BULK: "bankTransferReview.bulk",
  /** ウォレット失効予告（システム起点: wallet-expiration-notice cron） */
  WALLET_EXPIRATION_PRE_NOTICE: "wallet.expiration.preNotice",
  /** ウォレット失効時の本通知（システム起点: wallet-expiration-notice cron） */
  WALLET_EXPIRATION_EXPIRED_NOTICE: "wallet.expiration.expiredNotice",
} as const;

export type MessagingSource =
  (typeof MESSAGING_SOURCES)[keyof typeof MESSAGING_SOURCES];
