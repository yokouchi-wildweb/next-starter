// src/features/core/auditLog/components/common/AuditTimeline/AuditTimeline.tsx

"use client";

import { useAuditLogsByTarget } from "@/features/core/auditLog/hooks/useAuditLogsByTarget";

import { AUDIT_LOG_OBSERVER_OPTIONS, AuditLogListView } from "./AuditLogListView";

type Props = {
  /**
   * 監査対象ドメイン名。`auditLogger.record` 時の targetType と一致させる。
   * 例: "user", "post", "order"
   */
  targetType: string;
  /**
   * 個別ターゲットの履歴を表示する場合に指定。
   * 省略時は targetType 全体の履歴を時系列で返す（管理画面の cross-domain 用）。
   */
  targetId?: string;
  /**
   * 1 ページあたりの件数。既定: 20
   */
  pageSize?: number;
  /**
   * 親側からの追加クラス（containerに付与）。
   */
  className?: string;
};

/**
 * 汎用監査ログタイムライン（target_type / target_id 軸）。
 *
 * 任意のドメインの履歴タブに `<AuditTimeline targetType="user" targetId={id} />` の
 * 形で配置できる。action 名のラベル変換は `AUDIT_ACTION_LABELS`(src/config/app/audit.config.ts)で
 * ドメイン側から拡張可能。
 *
 * 「ユーザー単位の集約タイムライン」（target_type を跨ぐ）は別の
 * `<UserActivityTimeline userId={...} />` を使う。
 *
 * - 無限スクロール（IntersectionObserver）
 * - 行クリックで詳細モーダル
 * - before / after を持つ行は DiffView で差分表示
 */
export function AuditTimeline({
  targetType,
  targetId,
  pageSize = 20,
  className,
}: Props) {
  const query = useAuditLogsByTarget({
    targetType,
    targetId,
    limit: pageSize,
    observerOptions: AUDIT_LOG_OBSERVER_OPTIONS,
  });

  return (
    <AuditLogListView query={query} showTargetColumn={!targetId} className={className} />
  );
}
