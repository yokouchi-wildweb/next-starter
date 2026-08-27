// src/features/core/fingerprintChallenge/entities/drizzle.ts

import {
  foreignKey,
  index,
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
