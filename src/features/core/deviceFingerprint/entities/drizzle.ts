// src/features/core/deviceFingerprint/entities/drizzle.ts

import {
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

import { DEVICE_FINGERPRINT_SOURCES } from "@/features/core/deviceFingerprint/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";

export const DeviceFingerprintSourceEnum = pgEnum("device_fingerprint_source", [
  ...DEVICE_FINGERPRINT_SOURCES,
]);

/**
 * ブラウザフィンガープリント（デバイス信号）の蓄積テーブル。
 *
 * 用途はデバイス軸でのクロスユーザー照合
 * (同一端末で運用されているアカウント群の検出。userLoginEvent = IP 軸の兄弟)。
 *
 * 設計ポイント:
 * - 検索軸となる主要成分は個別カラムに展開する (ハッシュ 1 本比較だと 1 成分の
 *   変化で別デバイス扱いになるため、成分ごとの一致数スコアリングで照合する)。
 * - (user_id, composite_hash) UNIQUE で upsert し、同一端末の再訪は
 *   seen_count++ / last_seen_at 更新に畳む (行の無限増殖防止)。
 * - フィンガープリントはクライアント申告値であり偽装可能。参考証拠として扱う。
 * - 行単位 retention_days + 日次 cron プルーニング (userLoginEvent と同パターン)。
 */
export const DeviceFingerprintTable = pgTable(
  "device_fingerprints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    source: DeviceFingerprintSourceEnum("source").notNull(),
    /** 全成分ハッシュを連結した合成ハッシュ。完全一致検索と upsert キーに使う */
    compositeHash: text("composite_hash").notNull(),
    // --- 検索軸となる成分別カラム (null = その成分を取得できなかった環境) ---
    canvasHash: text("canvas_hash"),
    webglHash: text("webgl_hash"),
    audioHash: text("audio_hash"),
    fontsHash: text("fonts_hash"),
    /** "1920x1080x24@2" 形式の可読キー */
    screenKey: text("screen_key"),
    timezone: text("timezone"),
    languages: text("languages"),
    platform: text("platform"),
    /** "c8/m8/t0" 形式 (concurrency / memory / touchPoints) */
    hardwareKey: text("hardware_key"),
    /** 人間可読の WebGL renderer (管理画面での目視確認用。例: "Apple M1") */
    webglRenderer: text("webgl_renderer"),
    /** 成分別ハッシュの原本 (lib/fingerprint の FingerprintComponentHashes) */
    componentHashes: jsonb("component_hashes")
      .$type<Record<string, string | null>>()
      .notNull(),
    /** 正規化前の生信号。config の maxRawSignalsBytes 超過時は null */
    rawSignals: jsonb("raw_signals").$type<unknown>(),
    /** 収集時のクライアント IP (userLoginEvent と横断照合するための冗長保持) */
    ip: inet("ip"),
    userAgent: text("user_agent"),
    /** 同一 (user_id, composite_hash) が観測された回数 */
    seenCount: integer("seen_count").default(1).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    retentionDays: integer("retention_days").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // upsert キー: 同一ユーザー × 同一デバイスは 1 行に畳む
    userCompositeUnique: uniqueIndex("device_fingerprints_user_composite_idx").on(
      table.userId,
      table.compositeHash,
    ),
    // 完全一致のクロスユーザー検索
    compositeIdx: index("device_fingerprints_composite_idx").on(table.compositeHash),
    // 成分別の類似照合 (similarity.ts)。強成分のみ index を張る
    canvasIdx: index("device_fingerprints_canvas_idx").on(table.canvasHash),
    audioIdx: index("device_fingerprints_audio_idx").on(table.audioHash),
    webglIdx: index("device_fingerprints_webgl_idx").on(table.webglHash),
    fontsIdx: index("device_fingerprints_fonts_idx").on(table.fontsHash),
    // ユーザー別タイムライン
    userIdx: index("device_fingerprints_user_idx").on(table.userId, table.lastSeenAt),
    // retention pruning 用
    createdAtIdx: index("device_fingerprints_created_at_idx").on(table.createdAt),
  }),
);
