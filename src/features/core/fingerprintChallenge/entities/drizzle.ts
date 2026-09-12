// src/features/core/fingerprintChallenge/entities/drizzle.ts

import {
  foreignKey,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { FINGERPRINT_CHALLENGE_STATUSES } from "@/features/core/fingerprintChallenge/constants";
import { DeviceFingerprintTable } from "@/features/core/deviceFingerprint/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { defineHiddenColumns } from "@/lib/crud/drizzle/hiddenColumns";

export const FingerprintChallengeStatusEnum = pgEnum("fingerprint_challenge_status", [
  ...FINGERPRINT_CHALLENGE_STATUSES,
]);

/**
 * 不正疑いユーザーへの回答チャレンジ。
 *
 * ライフサイクル: 管理者が発行 (トークン付き URL をユーザーに案内)
 * → ユーザーが本人ログイン + トークンの二重検証つきで回答提出
 * → 提出時にデバイスフィンガープリント + 行動計測 payload を強制添付
 * → 管理者がレビュー。
 *
 * 設計ポイント:
 * - フォームの質問内容 (prompt) と回答 (answers) は自由形式 JSONB。
 *   フォーム画面・スキーマ定義は downstream 所有 (README のレシピ参照)。
 * - 生トークンは発行時に 1 回だけ返却し、DB には SHA-256 のみ保存する。
 *   token_hash は hiddenColumns でサービス境界から一切出さない。
 * - 監査は wrapper が意味づけした action (fingerprint.challenge.issued 等) で
 *   手動記録する (CRUD 自動監査は使わない)。
 * - エンゲージメント計測 (通知 → 初回閲覧 → N 回閲覧 → 最終閲覧 → 提出) を 1 行で
 *   追えるよう notified_at / first_viewed_at / last_viewed_at / view_count を持つ。
 *   閲覧系は FINGERPRINT_CONFIG.challenge.accessLog.enabled (既定 false) の時だけ更新される。
 *   per-access の IP + UA は FingerprintChallengeAccessEventTable (retention 付き)。
 */
export const FingerprintChallengeTable = pgTable(
  "fingerprint_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    /** 回答 URL 用トークンの SHA-256。生トークンは保存しない */
    tokenHash: text("token_hash").notNull(),
    status: FingerprintChallengeStatusEnum("status").default("pending").notNull(),
    /** 管理者が定義する質問・文言 (自由形式。downstream のフォーム画面が解釈する) */
    prompt: jsonb("prompt").$type<unknown>(),
    /** ユーザーの回答 (自由形式) */
    answers: jsonb("answers").$type<unknown>(),
    /** useBehavioralCapture の行動計測 payload */
    behavior: jsonb("behavior").$type<unknown>(),
    /** 提出時に記録された device_fingerprints 行への参照 */
    fingerprintId: uuid("fingerprint_id"),
    issuedBy: uuid("issued_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by"),
    reviewNote: text("review_note"),
    /** 管理者が案内を送った時刻 (初回のみ記録。再通知は audit_logs fingerprint.challenge.notified に残る) */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    /** 案内に使ったチャネルの和集合 (例: ["email","in_app"]。語彙は downstream 自由) */
    notifiedChannels: text("notified_channels").array().default([]).notNull(),
    /** ユーザーが本人向け取得ルートで初めて開いた時刻 (accessLog 有効時のみ) */
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    /** 同・最後に開いた時刻 (dedupe 窓内の連続アクセスは更新しない) */
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    /** 同・閲覧回数 (dedupe 済み)。pending の間だけ増える */
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("fingerprint_challenges_token_hash_idx").on(table.tokenHash),
    // ユーザー別の発行履歴
    userIdx: index("fingerprint_challenges_user_idx").on(table.userId, table.createdAt),
    // admin 一覧の未回答 / 未レビューフィルタ
    statusIdx: index("fingerprint_challenges_status_idx").on(table.status, table.createdAt),
    // 自動生成名が 63 文字を超えないよう明示名を与える FK 群
    fingerprintFk: foreignKey({
      columns: [table.fingerprintId],
      foreignColumns: [DeviceFingerprintTable.id],
      name: "fp_challenges_fingerprint_fk",
    }).onDelete("set null"),
    issuedByFk: foreignKey({
      columns: [table.issuedBy],
      foreignColumns: [UserTable.id],
      name: "fp_challenges_issued_by_fk",
    }).onDelete("set null"),
    reviewedByFk: foreignKey({
      columns: [table.reviewedBy],
      foreignColumns: [UserTable.id],
      name: "fp_challenges_reviewed_by_fk",
    }).onDelete("set null"),
  }),
);

// 生トークンの照合はサービス内部の専用経路のみで行い、token_hash は
// HTTP レスポンスを含む全サービス返却で null 化する (fail-closed)
defineHiddenColumns(FingerprintChallengeTable, ["tokenHash"]);

/**
 * チャレンジを本人向け取得ルートで開いた 1 回ごとのアクセス記録 (IP + UA のタイムライン)。
 *
 * 用途: 「提出前にどのネットワークから何度開いたか」の証拠。ログイン履歴 (userLoginEvent)
 * と異なるネットワークからの閲覧、bot 的な UA、未提出のまま多数回閲覧、等の材料になる。
 *
 * 設計ポイント:
 * - FINGERPRINT_CONFIG.challenge.accessLog.enabled が true の時だけ追記される (既定 false)。
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
