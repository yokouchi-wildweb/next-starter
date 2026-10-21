// src/features/core/pairedDevice/entities/drizzle.ts

import { foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type { DevicePairingFlow, DevicePairingStatus } from "@/features/core/pairedDevice/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { defineHiddenColumns } from "@/lib/crud/drizzle/hiddenColumns";

/**
 * 登録端末（店舗のタブレット・キオスク等の共有端末）。ユーザーとは別の認証主体。
 *
 * ライフサイクル: 管理者が端末を登録 (label / kind / scope)
 * → ペアリング（device_pairings）で端末トークンを発行（Cookie）
 * → 端末はトークンで認証し続ける（有効期限はスライディング延長）
 * → 失効（revoked_at）で即座に無効。再ペアリングでトークンを差し替える（古いトークンは無効）。
 *
 * 設計ポイント:
 * - kind / scope の語彙と形は downstream が src/registry/pairedDeviceKindRegistry.ts で決める。
 *   アップストリームは scope の中身を解釈しない（scopeSchema で検証するだけ）。
 * - 生トークンは DB に保存しない。token_hash（SHA-256）は hiddenColumns でサービス境界から出さない。
 *   未ペアリング・失効後は token_hash = null。
 * - 認証のたびに DB を引くので、失効・scope 変更は次のリクエストから効く。
 * - 監査は各操作が意味づけした action（paired_device.device.*）で手動記録する。
 */
export const PairedDeviceTable = pgTable(
  "paired_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 管理用の表示名（例: "3番テーブル"） */
    label: text("label").notNull(),
    /** 端末の種類（pairedDeviceKindRegistry のキー） */
    kind: text("kind").notNull(),
    /** 端末の所属（形は kind の scopeSchema。例: { storeId, tableId }） */
    scope: jsonb("scope").$type<unknown>().default({}).notNull(),
    /** 端末トークンの SHA-256。未ペアリング・失効後は null */
    tokenHash: text("token_hash"),
    /** 端末トークンの有効期限（スライディング延長される） */
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    /** 最後にペアリングした時刻 */
    pairedAt: timestamp("paired_at", { withTimezone: true }),
    /** ペアリング時の User-Agent（どの機材か確認する手がかり） */
    pairedUserAgent: text("paired_user_agent"),
    /** 最終アクセス時刻（lastSeenThrottleSeconds で間引いて更新） */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** 最終アクセス時の IP */
    lastSeenIp: text("last_seen_ip"),
    createdBy: uuid("created_by"),
    /** 失効時刻。null 以外は認証不可（再ペアリングで null に戻る） */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("paired_devices_token_hash_idx").on(table.tokenHash),
    // 管理一覧（kind 別）
    kindIdx: index("paired_devices_kind_idx").on(table.kind, table.createdAt),
    createdByFk: foreignKey({
      columns: [table.createdBy],
      foreignColumns: [UserTable.id],
      name: "paired_devices_created_by_fk",
    }).onDelete("set null"),
    revokedByFk: foreignKey({
      columns: [table.revokedBy],
      foreignColumns: [UserTable.id],
      name: "paired_devices_revoked_by_fk",
    }).onDelete("set null"),
  }),
);

defineHiddenColumns(PairedDeviceTable, ["tokenHash"]);

/**
 * ペアリング（端末トークンを受け取るための一時的なコード）。
 *
 * - admin_issued: 管理者が端末を選んでコードを発行 → 端末がコードを入力 → completed
 * - device_initiated: 端末がコードを発行（device_id は null）→ 管理者が承認して端末を割り当て（approved）
 *   → 端末が承認を確認しに来た時点でトークンを受け取る（completed）。
 *   コードを見ただけの第三者がトークンを受け取れないよう、受け取りには開始した端末だけが持つ
 *   pending_token（Cookie）が必要。
 *
 * コード・pending_token はハッシュのみ保存する。status は text（語彙は constants の DEVICE_PAIRING_STATUSES）。
 * 期限切れの行は cron で削除する（pruneExpiredDevicePairings）。
 */
export const DevicePairingTable = pgTable(
  "device_pairings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flow: text("flow").$type<DevicePairingFlow>().notNull(),
    status: text("status").$type<DevicePairingStatus>().default("pending").notNull(),
    /** 対象の端末。device_initiated では承認までは null */
    deviceId: uuid("device_id"),
    /** ペアリングコードの SHA-256（正規化後の値） */
    codeHash: text("code_hash").notNull(),
    /** device_initiated で、開始した端末だけが持つ照合トークンの SHA-256 */
    pendingTokenHash: text("pending_token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** admin_issued の発行者 */
    createdBy: uuid("created_by"),
    /** device_initiated の承認者 */
    approvedBy: uuid("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** device_initiated で、開始した端末の IP / User-Agent（承認画面で確認する材料） */
    requestIp: text("request_ip"),
    requestUserAgent: text("request_user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeHashIdx: index("device_pairings_code_hash_idx").on(table.codeHash),
    pendingTokenHashIdx: index("device_pairings_pending_token_idx").on(table.pendingTokenHash),
    deviceIdx: index("device_pairings_device_idx").on(table.deviceId, table.createdAt),
    // 期限切れ行の削除用
    expiresAtIdx: index("device_pairings_expires_at_idx").on(table.expiresAt),
    deviceFk: foreignKey({
      columns: [table.deviceId],
      foreignColumns: [PairedDeviceTable.id],
      name: "device_pairings_device_fk",
    }).onDelete("cascade"),
    createdByFk: foreignKey({
      columns: [table.createdBy],
      foreignColumns: [UserTable.id],
      name: "device_pairings_created_by_fk",
    }).onDelete("set null"),
    approvedByFk: foreignKey({
      columns: [table.approvedBy],
      foreignColumns: [UserTable.id],
      name: "device_pairings_approved_by_fk",
    }).onDelete("set null"),
  }),
);

defineHiddenColumns(DevicePairingTable, ["codeHash", "pendingTokenHash"]);
