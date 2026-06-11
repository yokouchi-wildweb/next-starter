// src/features/messaging/constants/actions.ts
//
// 監査ログの action 名定数。受信者単位で 1 行ずつ audit_logs に記録される。
// 命名規約は eslint-rules/audit-action-naming.mjs で <domain>.<entity>.<verb> 形式が強制される。

export const MESSAGING_AUDIT_ACTIONS = {
  /** 少なくとも 1 チャネルで配信が成立した受信者の記録 */
  MESSAGE_SENT: "messaging.message.sent",
  /** 試行した全チャネルで配信失敗した受信者の記録 */
  MESSAGE_FAILED: "messaging.message.failed",
} as const;

export type MessagingAuditAction =
  (typeof MESSAGING_AUDIT_ACTIONS)[keyof typeof MESSAGING_AUDIT_ACTIONS];
