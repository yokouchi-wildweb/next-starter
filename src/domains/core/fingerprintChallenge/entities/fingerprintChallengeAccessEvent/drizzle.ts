// src/domains/core/fingerprintChallenge/entities/fingerprintChallengeAccessEvent/drizzle.ts

import { FingerprintChallengeTable } from "../fingerprintChallenge/drizzle";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import { foreignKey, index, inet, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * チャレンジを本人向け取得ルートで開いた 1 回ごとのアクセス記録 (IP + UA のタイムライン)。
 *
 * 用途: 「提出前にどのネットワークから何度開いたか」の証拠。ログイン履歴 (userLoginEvent)
 * と異なるネットワークからの閲覧、bot 的な UA、未提出のまま多数回閲覧、等の材料になる。
 *
 * 設計ポイント:
 * - fingerprintChallengeConfig.challenge.accessLog.enabled が true の時だけ追記される (既定 false)。
 * - dedupeSeconds 窓内の連続アクセスは 1 件にまとめる (親行の last_viewed_at で判定)。
 * - IP を含むため行単位 retention_days + 日次 cron prune (userLoginEvent と同じ運用)。
 * - 集計用の親行カウンタ (view_count 等) は fingerprint_challenges 側。本テーブルは詳細。
 * - FK 名は 63 文字制限のため明示短縮名。
 */
export const FingerprintChallengeAccessEventTable = pgTable(
  "fingerprint_challenge_access_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id").notNull(),
    userId: uuid("user_id").notNull(),
    /** クライアント IP (取得できなかった場合は null。回数計測は IP 無しでも行う) */
    ip: inet("ip"),
    userAgent: text("user_agent"),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).defaultNow().notNull(),
    retentionDays: integer("retention_days").notNull(),
  },
  (table) => ({
    // チャレンジ別タイムライン (admin 詳細)
    challengeIdx: index("fp_challenge_access_events_challenge_idx").on(
      table.challengeId,
      table.accessedAt,
    ),
    // retention pruning 用 (accessed_at + retention_days * INTERVAL で算出)
    accessedAtIdx: index("fp_challenge_access_events_accessed_at_idx").on(table.accessedAt),
    challengeFk: foreignKey({
      columns: [table.challengeId],
      foreignColumns: [FingerprintChallengeTable.id],
      name: "fp_challenge_access_events_challenge_fk",
    }).onDelete("cascade"),
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [UserTable.id],
      name: "fp_challenge_access_events_user_fk",
    }).onDelete("cascade"),
  }),
);
