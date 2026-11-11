// src/features/core/messaging/scripts/migrations/lib.legacyCopyStore.ts
//
// 旧お知らせの写しの本物の置き場(PostgreSQL)。流れは lib.legacyCopy.ts、列の対応は lib.legacyCopyMap.ts。
// - next* は写し先の主キーを NOT EXISTS で見て「まだ写していない行」だけを返す(続きから写せる理由)
// - write* は ON CONFLICT DO NOTHING(watermark だけは GREATEST)。何度書いても同じ
// - 宛先ごとのお知らせの行の id = md5(<お知らせの id>::text || ':' || <利用者の id>::text)::uuid(lib.legacyCopyMap の legacyRecipientItemId と同じ)
// 生の SQL に Date を渡さない(ISO の文字列で渡す)。移行なので db・表の定義を直接読む(lint tools-no-db-write の例外)

import { and, asc, eq, gt, inArray, isNull, notExists, or, sql, type SQL } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";

import { MessageDispatchTable } from "../../entities/drizzle";
import { MessageInboxItemTable, MessageInboxReadStateTable, MessageInboxReadTable } from "../../entities/inbox";
import { MessageTemplateTable, MessageTemplateVersionTable } from "../../entities/template";
import { NotificationReadStateTable, NotificationReadTable, NotificationTable } from "../../legacy/notification";
import { NotificationTemplateTable } from "../../legacy/notificationTemplate";
import type { LegacyCopyCounts, LegacyCopyStore } from "./lib.legacyCopy";
import { LEGACY_DISPATCH_SOURCE, LEGACY_TEMPLATE_KEY_PREFIX } from "./lib.legacyCopyMap";

const N = NotificationTable;
const NR = NotificationReadTable;
const NS = NotificationReadStateTable;
const NT = NotificationTemplateTable;
const D = MessageDispatchTable;
const I = MessageInboxItemTable;
const R = MessageInboxReadTable;
const S = MessageInboxReadStateTable;
const T = MessageTemplateTable;
const V = MessageTemplateVersionTable;

/** 1 つの INSERT に載せる行の上限(個人宛ての多い回で文が大きくなりすぎないように) */
const INSERT_SLICE = 1000;

const UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

const slices = <T>(rows: readonly T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_SLICE) out.push(rows.slice(i, i + INSERT_SLICE));
  return out;
};

/** 既読が行き着くお知らせの行の id(個人宛ては読んだ人の行) */
const readItemIdSql = (notificationId: SQL | typeof N.id, userId: SQL | typeof NR.userId): SQL =>
  sql`CASE WHEN ${N.target_type} = 'individual' THEN md5(${notificationId}::text || ':' || ${userId}::text)::uuid ELSE ${notificationId} END`;

const rowsOf = <T>(result: unknown): T[] => (Array.isArray(result) ? (result as T[]) : []);

export const drizzleLegacyCopyStore: LegacyCopyStore = {
  async legacyTablesExist() {
    const rows = rowsOf(
      await db.execute(
        sql`SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('notifications', 'notification_reads', 'notification_read_states', 'notification_templates')`,
      ),
    );
    return rows.length === 4;
  },

  async nextTemplates(after, limit) {
    const rows = await db
      .select()
      .from(NT)
      .where(and(after ? gt(NT.id, after) : undefined, notExists(db.select({ one: sql`1` }).from(T).where(eq(T.id, NT.id)))))
      .orderBy(asc(NT.id))
      .limit(limit);
    return rows.map((row) => ({ ...row, createdAt: row.createdAt ?? null, updatedAt: row.updatedAt ?? null }));
  },

  async writeTemplates(rows) {
    if (rows.length === 0) return;
    await db.transaction(async (tx) => {
      await tx.insert(T).values(rows.map((row) => row.template)).onConflictDoNothing();
      await tx.insert(V).values(rows.map((row) => row.version)).onConflictDoNothing();
    });
  },

  async nextNotifications(after, limit) {
    const rows = await db
      .select()
      .from(N)
      .where(and(after ? gt(N.id, after) : undefined, notExists(db.select({ one: sql`1` }).from(D).where(eq(D.id, N.id)))))
      .orderBy(asc(N.id))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      notificationTemplateId: row.notification_template_id,
      title: row.title,
      body: row.body,
      image: row.image,
      targetType: row.target_type,
      targetUserIds: row.target_user_ids,
      targetRoles: row.target_roles,
      senderType: row.sender_type,
      createdById: row.created_by_id,
      metadata: row.metadata ?? null,
      isSilent: row.is_silent,
      publishedAt: row.published_at,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    }));
  },

  async existingUserIds(ids) {
    if (ids.length === 0) return new Set();
    const rows = await db.select({ id: UserTable.id }).from(UserTable).where(inArray(UserTable.id, [...ids]));
    return new Set(rows.map((row) => row.id.toLowerCase()));
  },

  async writeNotifications(rows) {
    if (rows.length === 0) return;
    await db.transaction(async (tx) => {
      await tx.insert(D).values(rows.map((row) => row.dispatch)).onConflictDoNothing();
      for (const part of slices(rows.flatMap((row) => row.items))) {
        await tx.insert(I).values(part).onConflictDoNothing();
      }
    });
  },

  async nextReads(after, limit) {
    const rows = await db
      .select({ notificationId: NR.notificationId, userId: NR.userId, readAt: NR.readAt, targetType: N.target_type })
      .from(NR)
      .innerJoin(N, eq(N.id, NR.notificationId))
      .where(
        and(
          after ? sql`(${NR.notificationId}, ${NR.userId}) > (${after.notificationId}::uuid, ${after.userId}::uuid)` : undefined,
          notExists(
            db
              .select({ one: sql`1` })
              .from(R)
              .where(and(eq(R.user_id, NR.userId), sql`${R.item_id} = ${readItemIdSql(N.id, NR.userId)}`)),
          ),
        ),
      )
      .orderBy(asc(NR.notificationId), asc(NR.userId))
      .limit(limit);
    return rows;
  },

  async existingItemIds(ids) {
    if (ids.length === 0) return new Set();
    const rows = await db.select({ id: I.id }).from(I).where(inArray(I.id, [...ids]));
    return new Set(rows.map((row) => row.id));
  },

  async writeReads(rows) {
    for (const part of slices(rows)) {
      await db.insert(R).values(part).onConflictDoNothing();
    }
  },

  async nextReadStates(after, limit) {
    const rows = await db
      .select()
      .from(NS)
      .where(
        and(
          after ? gt(NS.userId, after) : undefined,
          notExists(
            db
              .select({ one: sql`1` })
              .from(S)
              .where(and(eq(S.user_id, NS.userId), or(isNull(NS.readWatermarkAt), sql`${S.read_watermark_at} >= ${NS.readWatermarkAt}`))),
          ),
        ),
      )
      .orderBy(asc(NS.userId))
      .limit(limit);
    return rows.map((row) => ({ userId: row.userId, readWatermarkAt: row.readWatermarkAt ?? null, updatedAt: row.updatedAt ?? null }));
  },

  async writeReadStates(rows) {
    if (rows.length === 0) return;
    await db
      .insert(S)
      .values(rows)
      .onConflictDoUpdate({
        target: S.user_id,
        set: {
          read_watermark_at: sql`GREATEST(${S.read_watermark_at}, EXCLUDED.read_watermark_at)`,
          updatedAt: sql`GREATEST(${S.updatedAt}, EXCLUDED.updated_at)`,
        },
      });
  },

  async nextDispatchFills(after, limit) {
    const rows = await db
      .select({
        id: D.id,
        channels: D.channels,
        emailSubject: D.email_subject,
        emailBody: D.email_body,
        notificationTitle: D.notification_title,
        notificationBody: D.notification_body,
        recipientCount: D.recipient_count,
        emailSuccessCount: D.email_success_count,
        emailFailedCount: D.email_failed_count,
        notificationCreated: D.notification_created,
      })
      .from(D)
      .where(and(after ? gt(D.id, after) : undefined, unfilledDispatchSql()))
      .orderBy(asc(D.id))
      .limit(limit);
    return rows;
  },

  async writeDispatchFills(rows) {
    if (rows.length === 0) return;
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .update(D)
          .set({ headings: row.headings, rendered: row.rendered, channel_counts: row.channel_counts, updatedAt: sql`now()` })
          .where(and(eq(D.id, row.id), isNull(D.channel_counts)));
      }
    });
  },

  async counts() {
    const [row] = rowsOf<Record<string, string | number | null>>(await db.execute(COUNTS_SQL));
    const n = (key: string): number => Number(row?.[key] ?? 0);
    const line = (source: string, expected: string, copied: string, skipped?: string) => ({
      source: n(source),
      expected: n(expected),
      copied: n(copied),
      ...(skipped ? { skipped: n(skipped) } : {}),
    });
    const counts: LegacyCopyCounts = {
      templates: line("templates_source", "templates_source", "templates_copied"),
      templateVersions: line("templates_source", "templates_source", "versions_copied"),
      dispatches: line("notifications_source", "notifications_source", "dispatches_copied"),
      items: line("items_source", "items_expected", "items_copied", "items_skipped"),
      reads: line("reads_source", "reads_expected", "reads_copied", "reads_skipped"),
      readStates: line("read_states_source", "read_states_source", "read_states_copied"),
      dispatchFill: line("fill_expected", "fill_expected", "fill_copied"),
    };
    return counts;
  },
};

/** 新しい列を埋める古い送る口の回(定義の鍵が無く、写した回でなく、channel_counts が空) */
function unfilledDispatchSql(): SQL {
  return sql`${D.message_key} IS NULL AND ${D.source} <> ${LEGACY_DISPATCH_SOURCE} AND ${D.channel_counts} IS NULL`;
}

/**
 * 照合の数(1 文)。expected = 写し元から見た写すべき数:
 * - items = 共有の行(全員・ロール)+ 個人宛ての宛先(重なりを除き、uuid の形で今いる利用者)。skipped = それ以外の宛先
 * - reads = 行き先のお知らせの行が写し先にある既読。skipped = 行き先の無い既読
 * - read_states = 全部。copied = 写し先の watermark が写し元以上の行
 * - fill = 古い送る口の回。copied = channel_counts を埋めた行
 */
const COUNTS_SQL = sql`
WITH recipients AS (
  SELECT DISTINCT n.id AS notification_id, lower(x.uid) AS uid
  FROM ${N} n, unnest(n.target_user_ids) AS x(uid)
  WHERE n.target_type = 'individual'
),
recipient_ids AS (
  SELECT notification_id, CASE WHEN uid ~ ${UUID_PATTERN} THEN uid::uuid END AS user_id FROM recipients
),
valid_recipients AS (
  SELECT r.notification_id, r.user_id FROM recipient_ids r JOIN ${UserTable} u ON u.id = r.user_id
),
legacy_dispatches AS (
  SELECT d.id FROM ${D} d WHERE d.source = ${LEGACY_DISPATCH_SOURCE}
),
read_targets AS (
  SELECT nr.user_id,
    CASE WHEN n.target_type = 'individual' THEN md5(n.id::text || ':' || nr.user_id::text)::uuid ELSE n.id END AS item_id
  FROM ${NR} nr JOIN ${N} n ON n.id = nr.notification_id
)
SELECT
  (SELECT count(*) FROM ${NT}) AS templates_source,
  (SELECT count(*) FROM ${NT} o JOIN ${T} t ON t.id = o.id AND t.key = ${LEGACY_TEMPLATE_KEY_PREFIX} || o.id::text) AS templates_copied,
  (SELECT count(*) FROM ${NT} o JOIN ${V} v ON v.template_id = o.id AND v.version = 1) AS versions_copied,
  (SELECT count(*) FROM ${N}) AS notifications_source,
  (SELECT count(*) FROM ${N} n JOIN legacy_dispatches d ON d.id = n.id) AS dispatches_copied,
  (SELECT count(*) FROM ${N} WHERE target_type <> 'individual') + (SELECT count(*) FROM recipients) AS items_source,
  (SELECT count(*) FROM ${N} WHERE target_type <> 'individual') + (SELECT count(*) FROM valid_recipients) AS items_expected,
  (SELECT count(*) FROM recipients) - (SELECT count(*) FROM valid_recipients) AS items_skipped,
  (SELECT count(*) FROM ${I} i JOIN legacy_dispatches d ON d.id = i.dispatch_id) AS items_copied,
  (SELECT count(*) FROM ${NR}) AS reads_source,
  (SELECT count(*) FROM read_targets rt WHERE EXISTS (SELECT 1 FROM ${I} i WHERE i.id = rt.item_id)) AS reads_expected,
  (SELECT count(*) FROM read_targets rt WHERE NOT EXISTS (SELECT 1 FROM ${I} i WHERE i.id = rt.item_id)) AS reads_skipped,
  (SELECT count(*) FROM read_targets rt JOIN ${R} r ON r.item_id = rt.item_id AND r.user_id = rt.user_id) AS reads_copied,
  (SELECT count(*) FROM ${NS}) AS read_states_source,
  (SELECT count(*) FROM ${NS} s JOIN ${S} ns ON ns.user_id = s.user_id
     AND (s.read_watermark_at IS NULL OR ns.read_watermark_at >= s.read_watermark_at)) AS read_states_copied,
  (SELECT count(*) FROM ${D} WHERE message_key IS NULL AND source <> ${LEGACY_DISPATCH_SOURCE}) AS fill_expected,
  (SELECT count(*) FROM ${D} WHERE message_key IS NULL AND source <> ${LEGACY_DISPATCH_SOURCE} AND channel_counts IS NOT NULL) AS fill_copied
`;
