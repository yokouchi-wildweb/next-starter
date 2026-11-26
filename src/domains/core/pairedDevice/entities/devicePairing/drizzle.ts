// src/domains/core/pairedDevice/entities/devicePairing/drizzle.ts

import { PairedDeviceTable } from "../pairedDevice/drizzle";
import { UserTable } from "@/domains/core/user/entities/drizzle";
import type { DevicePairingFlow, DevicePairingStatus } from "@/domains/pairedDevice/constants";
import { defineHiddenColumns } from "@/lib/crud/server";
import { foreignKey, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
 * 期限切れから 1 日たった行は増設点 expiryRules の項目 plugs/expiryRules/pairedDevicePairingsPrune.ts が削除する（cron expiry-prune）。
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
