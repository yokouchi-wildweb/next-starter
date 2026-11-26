// src/domains/core/pairedDevice/entities/pairedDevice/drizzle.ts

import { UserTable } from "@/domains/core/user/entities/drizzle";
import { defineHiddenColumns } from "@/lib/crud/server";
import { foreignKey, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * 登録端末（店舗のタブレット・キオスク等の共有端末）。ユーザーとは別の認証主体。
 *
 * ライフサイクル: 管理者が端末を登録 (label / kind / scope)
 * → ペアリング（device_pairings）で端末トークンを発行（Cookie）
 * → 端末はトークンで認証し続ける（有効期限はスライディング延長）
 * → 失効（revoked_at）で即座に無効。再ペアリングでトークンを差し替える（古いトークンは無効）。
 *
 * 設計ポイント:
 * - kind / scope の語彙と形は downstream が <ドメイン>/plugs/pairedDeviceKinds/<名前>.ts で決める。
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
    /** 端末の種類（一覧 kinds の kind） */
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
