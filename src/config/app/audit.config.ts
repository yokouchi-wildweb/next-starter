// src/config/app/audit.config.ts
// 監査ログの値(開示の許可リスト・action の表示名)。

/**
 * action の表示名(AuditTimeline / 管理画面)。上流の既定は auditLog/presenters.ts、同じ action はこちらが勝つ。
 * 例: { "post.published": "公開" }。未登録の action は名前がそのまま表示される
 */
export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {};

/*
監査ログ action の「ユーザー本人への開示」許可リスト。
serviceRegistry（ドメインを作ると 1 行増える一覧。生成物）とは役割が違う。

GET /api/me/audit-logs は、ここに登録された action のログのみを本人に返す。

fail-closed: 未登録の action は本人が target / actor であっても一切返さない。
監査ログには covert な管理操作（不正フラグ、強制介入、制限措置等）が
before/after ペイロード込みで記録されるため、既定は「全 action 非開示」。
ユーザー向け履歴 UI で見せてよい action だけを明示的に列挙すること。

記法:
- 完全一致: "wallet.balance.charged"
- prefix ワイルドカード: "user.profile.*"（"user.profile." で始まる全 action。
  末尾 ".*" のみサポート。単独の "*" は全開示になるため登録禁止）

登録例（下流ドメイン）:

*/
export const USER_VISIBLE_AUDIT_ACTIONS: readonly string[] = [];
