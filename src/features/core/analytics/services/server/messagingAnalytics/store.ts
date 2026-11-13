// src/features/core/analytics/services/server/messagingAnalytics/store.ts
// 連絡の集計の SQL(読むだけ。messaging の表を参照し、messaging からは analytics を読まない)。
//
// 送りの組(回):
// - 基準の時刻 = 回を送った時刻 COALESCE(scheduled_at, created_at)。開封・既読・到達もこの日に数える(同じ組の率)
// - status scheduled / cancelled は外す、is_test は外す、取り下げた回は数える
// - source legacy.notification(写した前のお知らせ)の回は既読の数だけに使う(送り・到達の数に入れない)
// - created_at の索引を使うため created_at も範囲で絞る(予約は最大 schedule.maxDaysAhead 日前に作られる)
// 配信停止は止めた時刻で数える(前のトークン・好みのページの停止は回に結び付かない)。
// raw SQL に JS の Date は入れない(ISO の文字列で渡す)。

import { inArray, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { MessageDeliveryTable } from "@/features/core/messaging/entities/delivery";
import { MessageDispatchTable } from "@/features/core/messaging/entities/drizzle";
import {
  MessageInboxItemTable,
  MessageInboxReadStateTable,
  MessageInboxReadTable,
} from "@/features/core/messaging/entities/inbox";
import { MessagePreferenceTable, MessageSuppressionTable } from "@/features/core/messaging/entities/preference";
import { MessageTemplateTable } from "@/features/core/messaging/entities/template";
import { messagingConfig } from "@/features/core/messaging/config";
import { PREFERENCE_SIGNUP_SOURCE } from "@/features/core/messaging/constants/preferences";

import { granularityDateExpr } from "../utils/dateRange";
import type {
  DeliveryCountRow,
  DispatchCountRow,
  DispatchPageRow,
  MessagingAnalyticsStore,
  MessagingQueryScope,
  PeriodKey,
  ReadCountRow,
  UnsubscribeCountRow,
} from "./types";

/** 写した前のお知らせの回の source(既読の数だけに使う) */
export const LEGACY_NOTIFICATION_SOURCE = "legacy.notification";

const D = MessageDispatchTable;
const X = MessageDeliveryTable;
const I = MessageInboxItemTable;
const R = MessageInboxReadTable;
const S = MessageInboxReadStateTable;
const P = MessagePreferenceTable;
const Q = MessageSuppressionTable;
const U = UserTable;

const DAY_MS = 24 * 60 * 60 * 1000;
const anchor = sql`COALESCE(${D.scheduled_at}, ${D.createdAt})`;

/** db.execute の行(ドライバにより配列か { rows }) */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

const iso = (date: Date) => date.toISOString();
const num = (value: unknown) => Number(value ?? 0);
const idList = (ids: readonly string[]) => sql.join(ids.map((id) => sql`${id}`), sql`, `);

function windowOf(scope: MessagingQueryScope): { from: Date; to: Date } {
  return { from: scope.previous?.from ?? scope.current.from, to: scope.current.to };
}

/** 期間の印(前の期間が無ければ全部 cur) */
function periodExpr(scope: MessagingQueryScope, time: SQL): SQL {
  return scope.previous
    ? sql`CASE WHEN ${time} >= ${iso(scope.current.from)} THEN 'cur' ELSE 'prev' END`
    : sql`'cur'`;
}

/** 回の WHERE(送りの組)。withLegacy = 写した前のお知らせの回も入れる(既読) */
export function dispatchWhere(scope: MessagingQueryScope, options: { withLegacy: boolean }): SQL {
  const { from, to } = windowOf(scope);
  const createdFloor = new Date(from.getTime() - messagingConfig.schedule.maxDaysAhead * DAY_MS);
  const parts: SQL[] = [
    sql`${anchor} >= ${iso(from)}`,
    sql`${anchor} <= ${iso(to)}`,
    sql`${D.createdAt} <= ${iso(to)}`,
    sql`${D.createdAt} >= ${iso(createdFloor)}`,
    sql`${D.status} NOT IN ('scheduled', 'cancelled')`,
    sql`${D.is_test} = false`,
  ];
  if (!options.withLegacy) parts.push(sql`${D.source} <> ${LEGACY_NOTIFICATION_SOURCE}`);
  if (scope.filter.messageKey) parts.push(sql`${D.message_key} = ${scope.filter.messageKey}`);
  if (scope.filter.category) parts.push(sql`${D.category} = ${scope.filter.category}`);
  if (scope.groupBy === "dispatch") {
    parts.push(scope.dispatchIds && scope.dispatchIds.length > 0 ? sql`${D.id} IN (${idList(scope.dispatchIds)})` : sql`false`);
  }
  return sql.join(parts, sql` AND `);
}

/** 回を元にした軸の値(channel は行の経路で分けるので null) */
function dispatchGroupExpr(scope: MessagingQueryScope): SQL {
  switch (scope.groupBy) {
    case "date":
      return granularityDateExpr(anchor, scope.granularity, scope.timezone);
    case "message":
      return sql`${D.message_key}`;
    case "category":
      return sql`${D.category}`;
    case "template":
      return sql`${D.template_id}::text`;
    case "tag":
      return sql`tag_axis.tag`;
    case "dispatch":
      return sql`${D.id}::text`;
    case "rollup":
      return sql`json_build_array(${D.message_key}, ${D.category})::text`;
    default:
      return sql`NULL::text`;
  }
}

/** タグの軸は回のタグごとに 1 行(タグの無い回は null の 1 行) */
function tagJoin(scope: MessagingQueryScope): SQL {
  return scope.groupBy === "tag" ? sql`LEFT JOIN LATERAL unnest(${D.tags}) AS tag_axis(tag) ON true` : sql``;
}

type Raw = Record<string, unknown>;

async function dispatchCounts(scope: MessagingQueryScope): Promise<DispatchCountRow[]> {
  const channelFilter = scope.filter.channel ? sql`AND cc.key = ${scope.filter.channel}` : sql``;
  const field = (name: string) => sql`SUM(COALESCE((cc.value ->> ${name})::int, 0))::int`;
  const rows = rowsOf<Raw>(
    await db.execute(sql`
      SELECT ${periodExpr(scope, anchor)} AS period, ${dispatchGroupExpr(scope)} AS grp, cc.key AS channel,
        ${field("targeted")} AS targeted, ${field("sent")} AS sent, ${field("failed")} AS failed,
        ${field("skipped_no_address")} AS skipped_no_address, ${field("suppressed")} AS suppressed,
        ${field("skipped_throttled")} AS skipped_throttled
      FROM ${D}
      ${tagJoin(scope)}
      CROSS JOIN LATERAL jsonb_each(${D.channel_counts}) AS cc(key, value)
      WHERE ${dispatchWhere(scope, { withLegacy: false })} ${channelFilter}
      GROUP BY 1, 2, 3
    `),
  );
  return rows.map((row) => ({
    period: row.period as PeriodKey,
    group: (row.grp as string | null) ?? null,
    channel: String(row.channel),
    targeted: num(row.targeted),
    sent: num(row.sent),
    failed: num(row.failed),
    skippedNoAddress: num(row.skipped_no_address),
    suppressed: num(row.suppressed),
    skippedThrottled: num(row.skipped_throttled),
  }));
}

async function deliveryCounts(scope: MessagingQueryScope): Promise<DeliveryCountRow[]> {
  const channelFilter = scope.filter.channel ? sql`AND ${X.channel} = ${scope.filter.channel}` : sql``;
  const rows = rowsOf<Raw>(
    await db.execute(sql`
      SELECT ${periodExpr(scope, anchor)} AS period, ${dispatchGroupExpr(scope)} AS grp, ${X.channel} AS channel,
        COUNT(*) FILTER (WHERE ${X.status} = 'delivered' OR ${X.delivered_at} IS NOT NULL)::int AS delivered,
        COUNT(*) FILTER (WHERE ${X.status} = 'bounced')::int AS bounced,
        COUNT(*) FILTER (WHERE ${X.complained_at} IS NOT NULL)::int AS complained,
        COUNT(*) FILTER (WHERE ${X.opened_at} IS NOT NULL)::int AS opened,
        COUNT(*) FILTER (WHERE ${X.clicked_at} IS NOT NULL)::int AS clicked
      FROM ${D}
      JOIN ${X} ON ${X.dispatch_id} = ${D.id}
      ${tagJoin(scope)}
      WHERE ${dispatchWhere(scope, { withLegacy: false })} ${channelFilter}
      GROUP BY 1, 2, 3
    `),
  );
  return rows.map((row) => ({
    period: row.period as PeriodKey,
    group: (row.grp as string | null) ?? null,
    channel: String(row.channel),
    delivered: num(row.delivered),
    bounced: num(row.bounced),
    complained: num(row.complained),
    opened: num(row.opened),
    clicked: num(row.clicked),
  }));
}

/**
 * 既読の数(お知らせ = inApp)。受信者ごとの行 = 既読の行か watermark ≥ 公開の時刻。
 * 共有の行(全員・ロール)= 見られる利用者(ロール・後から登録した人の扱い)のうち、既読の行か watermark ≥ 公開の時刻の人の数
 */
async function readCounts(scope: MessagingQueryScope): Promise<ReadCountRow[]> {
  if (scope.filter.channel && scope.filter.channel !== "inApp") return [];
  const rows = rowsOf<Raw>(
    await db.execute(sql`
      SELECT ${periodExpr(scope, anchor)} AS period, ${dispatchGroupExpr(scope)} AS grp,
        COALESCE(SUM(
          CASE WHEN ${I.user_id} IS NOT NULL THEN
            CASE WHEN EXISTS (SELECT 1 FROM ${R} WHERE ${R.item_id} = ${I.id} AND ${R.user_id} = ${I.user_id})
              OR ${I.published_at} <= COALESCE(
                (SELECT ${S.read_watermark_at} FROM ${S} WHERE ${S.user_id} = ${I.user_id}),
                '-infinity'::timestamptz
              )
            THEN 1 ELSE 0 END
          ELSE (
            SELECT COUNT(*) FROM ${U}
            LEFT JOIN ${S} ON ${S.user_id} = ${U.id}
            WHERE ${U.deletedAt} IS NULL
              AND (${I.target_roles} IS NULL OR ${U.role}::text = ANY(${I.target_roles}))
              AND (${D.show_to_later_signups} OR ${U.createdAt} <= ${I.published_at})
              AND (
                EXISTS (SELECT 1 FROM ${R} WHERE ${R.item_id} = ${I.id} AND ${R.user_id} = ${U.id})
                OR ${I.published_at} <= ${S.read_watermark_at}
              )
          )
          END
        ), 0)::int AS read
      FROM ${D}
      JOIN ${I} ON ${I.dispatch_id} = ${D.id}
      ${tagJoin(scope)}
      WHERE ${dispatchWhere(scope, { withLegacy: true })}
      GROUP BY 1, 2
    `),
  );
  return rows.map((row) => ({
    period: row.period as PeriodKey,
    group: (row.grp as string | null) ?? null,
    read: num(row.read),
  }));
}

/** 配信停止の行の軸の値(回に結んだ値。template / tag は残っている回から引く) */
function unsubscribeGroupExpr(
  scope: MessagingQueryScope,
  columns: { time: SQL; category: SQL; messageKey: SQL; dispatchId: SQL },
): SQL {
  switch (scope.groupBy) {
    case "date":
      return granularityDateExpr(columns.time, scope.granularity, scope.timezone);
    case "message":
      return columns.messageKey;
    case "category":
      return columns.category;
    case "dispatch":
      return sql`${columns.dispatchId}::text`;
    case "template":
      return sql`(SELECT ${D.template_id}::text FROM ${D} WHERE ${D.id} = ${columns.dispatchId})`;
    case "tag":
      return sql`tag_axis.tag`;
    case "rollup":
      return sql`json_build_array(${columns.messageKey}, ${columns.category})::text`;
    default:
      return sql`NULL::text`;
  }
}

async function unsubscribeRows(
  scope: MessagingQueryScope,
  source: { table: SQL; time: SQL; channel: SQL; category: SQL; messageKey: SQL; dispatchId: SQL; extraWhere: SQL | null },
): Promise<UnsubscribeCountRow[]> {
  const { from, to } = windowOf(scope);
  const parts: SQL[] = [];
  // 回ごとのビューは結んだ回で数える(止めた時刻で絞らない)
  if (scope.groupBy === "dispatch") {
    parts.push(scope.dispatchIds && scope.dispatchIds.length > 0 ? sql`${source.dispatchId} IN (${idList(scope.dispatchIds)})` : sql`false`);
  } else {
    parts.push(sql`${source.time} >= ${iso(from)}`, sql`${source.time} <= ${iso(to)}`);
  }
  if (source.extraWhere) parts.push(source.extraWhere);
  if (scope.filter.channel) parts.push(sql`${source.channel} = ${scope.filter.channel}`);
  if (scope.filter.category) parts.push(sql`${source.category} = ${scope.filter.category}`);
  if (scope.filter.messageKey) parts.push(sql`${source.messageKey} = ${scope.filter.messageKey}`);
  const tag =
    scope.groupBy === "tag"
      ? sql`LEFT JOIN LATERAL unnest((SELECT ${D.tags} FROM ${D} WHERE ${D.id} = ${source.dispatchId})) AS tag_axis(tag) ON true`
      : sql``;
  const period = scope.groupBy === "dispatch" ? sql`'cur'` : periodExpr(scope, source.time);
  const rows = rowsOf<Raw>(
    await db.execute(sql`
      SELECT ${period} AS period, ${unsubscribeGroupExpr(scope, source)} AS grp, ${source.channel} AS channel, COUNT(*)::int AS count
      FROM ${source.table}
      ${tag}
      WHERE ${sql.join(parts, sql` AND `)}
      GROUP BY 1, 2, 3
    `),
  );
  return rows.map((row) => ({
    period: row.period as PeriodKey,
    group: (row.grp as string | null) ?? null,
    channel: String(row.channel),
    count: num(row.count),
  }));
}

async function unsubscribeCounts(scope: MessagingQueryScope): Promise<UnsubscribeCountRow[]> {
  const [preferences, suppressions] = await Promise.all([
    unsubscribeRows(scope, {
      table: sql`${P}`,
      time: sql`${P.opted_out_at}`,
      channel: sql`${P.channel}`,
      category: sql`${P.category}`,
      messageKey: sql`${P.source_message_key}`,
      dispatchId: sql`${P.source_dispatch_id}`,
      // 種別まるごとの行(kind が '*' でない、category '*')も数える。登録時の同意なし(source signup)は配信停止ではないので数えない
      extraWhere: sql`${P.source} <> ${PREFERENCE_SIGNUP_SOURCE}`,
    }),
    unsubscribeRows(scope, {
      table: sql`${Q}`,
      time: sql`${Q.createdAt}`,
      channel: sql`${Q.channel}`,
      category: sql`${Q.scope}`,
      messageKey: sql`${Q.source_message_key}`,
      dispatchId: sql`${Q.source_dispatch_id}`,
      extraWhere: sql`${Q.reason} = 'one_click'`,
    }),
  ]);
  return [...preferences, ...suppressions];
}

async function dispatchPage(params: Parameters<MessagingAnalyticsStore["dispatchPage"]>[0]): Promise<DispatchPageRow[]> {
  const scope: MessagingQueryScope = {
    current: { from: params.from, to: params.to },
    groupBy: "none",
    granularity: "day",
    timezone: "UTC",
    filter: params.filter,
  };
  const cursor = params.cursor
    ? sql`AND (${anchor}, ${D.id}) < (${iso(params.cursor.anchor)}::timestamptz, ${params.cursor.id}::uuid)`
    : sql``;
  const rows = rowsOf<Raw>(
    await db.execute(sql`
      SELECT ${D.id} AS id, ${D.message_key} AS message_key, ${D.category} AS category, ${D.kind} AS kind,
        ${D.template_id} AS template_id, ${D.tags} AS tags, ${anchor} AS anchor, ${D.status} AS status,
        ${D.retracted_at} AS retracted_at
      FROM ${D}
      WHERE ${dispatchWhere(scope, { withLegacy: false })} ${cursor}
      ORDER BY ${anchor} DESC, ${D.id} DESC
      LIMIT ${params.limit}
    `),
  );
  const toDate = (value: unknown) => (value instanceof Date ? value : value ? new Date(String(value)) : null);
  return rows.map((row) => ({
    id: String(row.id),
    messageKey: (row.message_key as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    kind: (row.kind as string | null) ?? null,
    templateId: (row.template_id as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? null,
    anchor: toDate(row.anchor)!,
    status: String(row.status),
    retractedAt: toDate(row.retracted_at),
  }));
}

async function templateNames(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: MessageTemplateTable.id, name: MessageTemplateTable.name })
    .from(MessageTemplateTable)
    .where(inArray(MessageTemplateTable.id, [...ids]));
  return new Map(rows.map((row) => [row.id, row.name]));
}

export const drizzleMessagingAnalyticsStore: MessagingAnalyticsStore = {
  dispatchCounts,
  deliveryCounts,
  readCounts,
  unsubscribeCounts,
  dispatchPage,
  templateNames,
};
