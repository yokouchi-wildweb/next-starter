// src/features/core/storageObject/entities/drizzle.ts

import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import type {
  StorageObjectDeleteReason,
  StorageObjectStatus,
  StorageObjectStore,
  StorageTransferKind,
} from "@/features/core/storageObject/entities/model";
import { defineHiddenColumns } from "@/lib/crud/drizzle/hiddenColumns";

/**
 * ファイル台帳。アップロード権の発行から業務行への紐付け・削除までを 1 行で追う。
 *
 * ライフサイクル: issue で pending → ブラウザが GCS へ直接送る → commit（HEAD で size・申告 MIME・
 * generation を照合）で ready → 業務保存と同じ TX で record_* を埋める（attach）
 * → 値の置換・業務行の物理削除で deleted（detach）→ 実物を消したら object_removed_at を埋める。
 *
 * 設計ポイント:
 * - 業務行の列には ref（storage://<store>/<key>）だけを保存し、この表が逆向きの紐付けを持つ
 * - owner_user_id は FK を張らない（ユーザーの物理削除で台帳を消さない。初版の決定）
 * - session_uri は GCS の再開可能セッション URI（それ自体がアップロード権）なので hiddenColumns で隠す。
 *   中止・期限切れではサーバーがこの URI を DELETE してから枠を返す
 * - 単発 PUT の署名 URL は取り消せないので、PUT の行は削除しても expires_at までは
 *   object_removed_at を埋めない（期限前の再送で実物が復活しうるため、掃除が期限後にもう一度消す）
 * - index はすべて素の列（push の往復を守る）
 */
export const StorageObjectTable = pgTable(
  "storage_objects",
  {
    /** 台帳 ID（uuidv7。ref とオブジェクトキーに入る） */
    id: uuid("id").primaryKey(),
    /** 用途 ID（`<domain>.<field>`） */
    purpose: text("purpose").notNull(),
    status: text("status").$type<StorageObjectStatus>().notNull(),
    /** 保存先（pub | priv） */
    store: text("store").$type<StorageObjectStore>().notNull(),
    /** 保存先の中でのオブジェクトキー `<purposeId>/<id>.<ext>`（物理パス = store の prefix + key） */
    key: text("key").notNull(),
    /** アップロードした利用者。サーバー内の書き込み（cron・system）は null */
    ownerUserId: uuid("owner_user_id"),
    /** 用途の判定に使う範囲（チャットのルーム ID・振込依頼 ID など） */
    scopeId: text("scope_id"),
    /** 発行時に申告されたサイズ（バイト） */
    declaredSize: bigint("declared_size", { mode: "number" }).notNull(),
    /** commit で HEAD から記録したサイズ */
    size: bigint("size", { mode: "number" }),
    /** 発行時は申告値、commit 後は HEAD の値 */
    contentType: text("content_type").notNull(),
    /** commit で HEAD から記録した世代（読み取り署名・削除はこの世代だけを対象にする） */
    generation: text("generation"),
    transferKind: text("transfer_kind").$type<StorageTransferKind>().notNull(),
    /** 再開可能セッション URI（transfer_kind = session のときだけ） */
    sessionUri: text("session_uri"),
    /** 紐付け先の業務行（attach で埋まる） */
    recordType: text("record_type"),
    recordId: text("record_id"),
    recordField: text("record_field"),
    /** アップロード権の受付期限 */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** 実物の削除が済んだ時刻。deleted でこれが null の行は掃除が拾う */
    objectRemovedAt: timestamp("object_removed_at", { withTimezone: true }),
    reason: text("reason").$type<StorageObjectDeleteReason>(),
  },
  (table) => ({
    storeKeyUnique: uniqueIndex("storage_objects_store_key_idx").on(table.store, table.key),
    // 期限切れ pending の掃除
    statusExpiresIdx: index("storage_objects_status_expires_idx").on(table.status, table.expiresAt),
    // 未完了数の数え上げ（maxPending）
    ownerStatusIdx: index("storage_objects_owner_status_idx").on(table.ownerUserId, table.status),
    // 業務行からの逆引き（detach）
    recordIdx: index("storage_objects_record_idx").on(table.recordType, table.recordId),
    // 未採用 ready の掃除
    statusReadyIdx: index("storage_objects_status_ready_idx").on(table.status, table.readyAt),
  }),
);

defineHiddenColumns(StorageObjectTable, ["sessionUri"]);
