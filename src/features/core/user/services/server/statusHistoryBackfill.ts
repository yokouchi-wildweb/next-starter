// src/features/core/user/services/server/statusHistoryBackfill.ts

import { sql } from "drizzle-orm";

import { AuditLogTable } from "@/features/core/auditLog/entities/drizzle";
import { UserStatusHistoryTable, UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";

export type StatusHistoryBackfillResult = {
  inserted: number;
};

/**
 * audit_logs からユーザーステータス遷移履歴（user_status_histories）を復元する
 * one-shot バックフィルタスク。
 *
 * user_status_histories 導入以前の遷移を、監査ログに残っている範囲で復元する。
 * - 対象 action を trigger 語彙（entities/model.ts の UserStatusTransitionTrigger）にマップ
 * - changed_at は監査ログの created_at をそのまま使用
 * - user.soft_deleted は監査ペイロード上 before/after の status が同値だが、
 *   実際は withdrawn へ遷移しているため to_status='withdrawn' に補正する
 * - 冪等: 同一 (user_id, to_status, changed_at) の既存行はスキップ（再実行安全）
 *
 * 制限:
 * - audit_logs の保持期限（既定365日）を過ぎて prune 済みの遷移は復元できない
 * - デモユーザー作成（監査ログなし）は対象外
 */
export async function backfillStatusHistoryFromAuditLogs(): Promise<StatusHistoryBackfillResult> {
  const result = (await db.execute(sql`
    WITH candidates AS (
      SELECT
        u.id AS user_id,
        CASE
          WHEN a.before_value->>'status' IN ('pending', 'active', 'inactive', 'suspended', 'banned', 'security_locked', 'withdrawn')
          THEN (a.before_value->>'status')::user_status
        END AS from_status,
        CASE
          WHEN a.action = 'user.soft_deleted' THEN 'withdrawn'::user_status
          WHEN a.after_value->>'status' IN ('pending', 'active', 'inactive', 'suspended', 'banned', 'security_locked', 'withdrawn')
          THEN (a.after_value->>'status')::user_status
        END AS to_status,
        CASE a.action
          WHEN 'user.withdrew' THEN 'self_withdraw'
          WHEN 'user.paused' THEN 'self_pause'
          WHEN 'user.reactivated' THEN 'self_reactivate'
          WHEN 'user.status.changed' THEN 'admin_change_status'
          WHEN 'user.soft_deleted' THEN 'admin_soft_delete'
          WHEN 'user.reregistered_by_admin' THEN 'admin_restore'
          WHEN 'user.created_by_admin' THEN 'admin_create'
          WHEN 'user.preregistered' THEN 'signup_pre_register'
          WHEN 'user.registered' THEN 'signup_activate'
          WHEN 'user.rejoined' THEN
            CASE WHEN a.after_value->>'status' = 'pending' THEN 'signup_pre_register' ELSE 'signup_activate' END
          WHEN 'auth.account.locked_permanent' THEN 'security_lockout'
        END AS trigger_value,
        a.created_at AS changed_at
      FROM ${AuditLogTable} a
      JOIN ${UserTable} u ON u.id::text = a.target_id
      WHERE a.target_type = 'user'
        AND a.action IN (
          'user.withdrew',
          'user.paused',
          'user.reactivated',
          'user.status.changed',
          'user.soft_deleted',
          'user.reregistered_by_admin',
          'user.created_by_admin',
          'user.preregistered',
          'user.registered',
          'user.rejoined',
          'auth.account.locked_permanent'
        )
    )
    INSERT INTO ${UserStatusHistoryTable} (user_id, from_status, to_status, "trigger", changed_at)
    SELECT c.user_id, c.from_status, c.to_status, c.trigger_value, c.changed_at
    FROM candidates c
    WHERE c.to_status IS NOT NULL
      AND c.from_status IS DISTINCT FROM c.to_status
      AND NOT EXISTS (
        SELECT 1 FROM ${UserStatusHistoryTable} h
        WHERE h.user_id = c.user_id
          AND h.to_status = c.to_status
          AND h.changed_at = c.changed_at
      )
    RETURNING id
  `)) as Array<{ id: string }>;

  return { inserted: result.length };
}
