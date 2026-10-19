// src/features/core/auditLog/components/common/UserActivityTimeline/UserActivityTimeline.tsx

"use client";

import { useAuditLogsBySubjectUser } from "@/features/core/auditLog/hooks/useAuditLogsBySubjectUser";

import { AUDIT_LOG_OBSERVER_OPTIONS, AuditLogListView } from "../AuditTimeline/AuditLogListView";

type Props = {
  /**
   * "data subject"（操作対象）となるユーザー ID。
   * `auditLogger.record({ subjectUserId })` でこの値が設定された全ログを集約表示する。
   */
  userId: string;
  /**
   * 1 ページあたりの件数。既定: 20
   */
  pageSize?: number;
  /**
   * 親側からの追加クラス（container に付与）。
   */
  className?: string;
};

/**
 * ユーザー単位の監査ログ集約タイムライン（subject_user_id 軸）。
 *
 * `auditLogger.record({ subjectUserId: userId })` が設定された全レコードを target_type を
 * 跨いで時系列表示する。
 *
 * 想定ユースケース:
 * - ユーザー詳細画面の「操作履歴」タブ（管理者が当該ユーザーに対して行った全操作）
 * - 退会後の調査・サポート対応・コンプラ監査
 *
 * 同一ユーザーに対する `user.*` / `wallet.*` / `user_item.*` / `subscription.*` 等の
 * 操作を 1 つのタイムラインに集約できる。`<AuditTimeline targetType="user" targetId={id} />`
 * は target_type='user' に限定されるが、こちらは関連エンティティ操作も含む。
 *
 * - 無限スクロール（IntersectionObserver）
 * - 行クリックで詳細モーダル
 * - 「対象」列を常時表示（複数 target_type が混在するため）
 */
export function UserActivityTimeline({ userId, pageSize = 20, className }: Props) {
  const query = useAuditLogsBySubjectUser({
    userId,
    limit: pageSize,
    observerOptions: AUDIT_LOG_OBSERVER_OPTIONS,
  });

  return <AuditLogListView query={query} showTargetColumn className={className} />;
}
