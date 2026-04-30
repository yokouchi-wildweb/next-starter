// src/features/core/auditLog/constants/index.ts

import { AUDIT_ACTOR_TYPES, type AuditActorType } from "@/lib/audit";

export { AUDIT_ACTOR_TYPES, type AuditActorType };

/**
 * デフォルトの保持期間（日数）。retention_days カラム未指定時のフォールバック。
 * 各ドメインの audit 設定で override 可能。
 *
 * 365 日 = 一般的なログ保持要件の最低ライン。コンプライアンス重視のドメインは長く設定する。
 */
export const DEFAULT_RETENTION_DAYS = 365;

/**
 * AUDIT_MODE 環境変数。
 * - "disabled": 全 audit 記録を no-op に切り替える（インシデント対応用の最終手段）
 * - その他: 通常動作
 *
 * 復旧後は別途 backfill / dead-letter 補填を検討すること。
 */
export const AUDIT_MODE_DISABLED = process.env.AUDIT_MODE === "disabled";

export const ACTOR_TYPE_LABELS: Record<AuditActorType, string> = {
  system: "システム",
  admin: "管理者",
  user: "ユーザー",
  api_key: "API キー",
  webhook: "Webhook",
};
