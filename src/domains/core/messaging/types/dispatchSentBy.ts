// src/domains/core/messaging/types/dispatchSentBy.ts
//
// 誰が送った送信か(送信の actor_type で分ける線。D210)。server と client が同じ物を読む
// - admin = 手動送信(管理者が管理画面から送った送信。actor_type が admin)
// - system = 自動送信(それ以外。actor_type が null を含む: 登録・購入の確認など連絡の自動の送信)
// 使う所: 送信の一覧の手動送信 / 自動送信の切り替え(GET /api/admin/messaging/dispatches の sentBy)・利用者ごとの履歴の sentBy。
// 条件の SQL は services/server/dispatchSentBy.ts の dispatchSentBySql だけが作る

export const DISPATCH_SENT_BY = ["admin", "system"] as const;
export type DispatchSentBy = (typeof DISPATCH_SENT_BY)[number];
