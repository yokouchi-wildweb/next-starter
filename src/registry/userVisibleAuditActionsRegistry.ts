// src/registry/userVisibleAuditActionsRegistry.ts
//
// 監査ログ action の「ユーザー本人への開示」許可リスト。
// interactionTargetRegistry と同じ「中央レジストリを下流が編集する」方式（サーバー専用）。
//
// GET /api/me/audit-logs は、ここに登録された action のログのみを本人に返す。
//
// fail-closed: 未登録の action は本人が target / actor であっても一切返さない。
// 監査ログには covert な管理操作（不正フラグ、強制介入、制限措置等）が
// before/after ペイロード込みで記録されるため、既定は「全 action 非開示」。
// ユーザー向け履歴 UI で見せてよい action だけを明示的に列挙すること。
//
// 記法:
// - 完全一致: "wallet.balance.charged"
// - prefix ワイルドカード: "user.profile.*"（"user.profile." で始まる全 action。
//   末尾 ".*" のみサポート。単独の "*" は全開示になるため登録禁止）
//
// 登録例（下流ドメイン）:
//   export const USER_VISIBLE_AUDIT_ACTIONS: readonly string[] = [
//     "wallet.balance.charged",
//     "user.profile.*",
//   ];
//
// admin 側の閲覧経路（/api/admin/audit-logs, AuditTimeline 等）はこのレジストリの
// 影響を受けない（全 action 閲覧可のまま）。

export const USER_VISIBLE_AUDIT_ACTIONS: readonly string[] = [
  // --- ここにユーザー本人へ開示してよい action を登録する（上流は空。下流が追記） ---
];
