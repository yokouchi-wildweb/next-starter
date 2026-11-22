// src/domains/core/messaging/services/server/admin/store.ts
//
// 送信の読む口の DB(drizzle)。keyset: 送信は (created_at, id) の降順、配達は昇順。
// 一覧の絞り: 送り元・送った人は索引あり(idx_message_dispatches_source / _actor)、件名の文字は索引なし(新しい順に limit まで探す)。
// 絞りの選択肢(送り元・運営として送った人)は鍵ごとの最後の送信の時刻の新しい順
// 送信の結果の口(sendResults.ts)は送信 1 件・届かなかった配達(昇順の keyset)・利用者の名前を読む。
// 既読した利用者 = inApp の行の個々の既読(message_inbox_reads)と利用者(削除した人は入れない)、既読の新しい順
// 送信の宛先の利用者 = 配達の user_id の重なりを除いた並び(「同じ内容で送る」の写し。送信チャンネルごとの行を 1 人にまとめる)

import { and, arrayContains, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, max, or, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserTable } from "@/domains/core/user/entities/drizzle";

import { MessageDeliveryTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageInboxItemTable, MessageInboxReadTable } from "../../../entities/inbox";
import type { MessageDeliveryStatus } from "../../../entities/model";
import { isDispatchId } from "../dispatchId";
import type { DispatchReadersStore } from "./dispatchReaders";
import type { AdminDispatchStore } from "./readDispatches";
import { UNDELIVERED_STATUSES, type SendResultsStore } from "./sendResults";
import { jsonbTextContains } from "./textSearch";

export const drizzleAdminDispatchStore: AdminDispatchStore = {
  async listDispatches(filter, after, limit) {
    const t = MessageDispatchTable;
    const conditions: SQL[] = [];
    if (filter.from) conditions.push(gte(t.createdAt, filter.from));
    if (filter.to) conditions.push(lt(t.createdAt, filter.to));
    if (filter.category) conditions.push(eq(t.category, filter.category));
    if (filter.kind) conditions.push(eq(t.kind, filter.kind));
    if (filter.channel) conditions.push(arrayContains(t.channels, [filter.channel]));
    if (filter.status) conditions.push(eq(t.status, filter.status));
    if (filter.source) conditions.push(eq(t.source, filter.source));
    if (filter.actor) conditions.push(eq(t.actor_id, filter.actor));
    if (filter.sentBy === "admin") conditions.push(eq(t.actor_type, "admin"));
    if (filter.q) conditions.push(jsonbTextContains(t.headings, filter.q, "children"));
    // 削除した送信(D88): 既定は出さない / only = 削除した送信だけ / include = 両方
    if (filter.deleted === "only") conditions.push(isNotNull(t.deleted_at));
    else if (filter.deleted !== "include") conditions.push(isNull(t.deleted_at));
    if (after) {
      conditions.push(or(lt(t.createdAt, after.createdAt), and(eq(t.createdAt, after.createdAt), lt(t.id, after.id)))!);
    }
    return db
      .select()
      .from(t)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(t.createdAt), desc(t.id))
      .limit(limit);
  },

  async findDispatch(id) {
    // uuid の形でない id は無い送信(Postgres の 500 にしない。呼び手が 404)
    if (!isDispatchId(id)) return null;
    const [row] = await db.select().from(MessageDispatchTable).where(eq(MessageDispatchTable.id, id)).limit(1);
    return row ?? null;
  },

  async listDispatchSources(limit) {
    const t = MessageDispatchTable;
    const rows = await db
      .select({ source: t.source, last: max(t.createdAt) })
      .from(t)
      .groupBy(t.source)
      .orderBy(desc(max(t.createdAt)), asc(t.source))
      .limit(limit);
    return rows.map((row) => row.source);
  },

  async listDispatchAdminActors(limit) {
    const t = MessageDispatchTable;
    const rows = await db
      .select({ actorId: t.actor_id, last: max(t.createdAt) })
      .from(t)
      .where(and(eq(t.actor_type, "admin"), isNotNull(t.actor_id)))
      .groupBy(t.actor_id)
      .orderBy(desc(max(t.createdAt)), asc(t.actor_id))
      .limit(limit);
    return rows.flatMap((row) => (row.actorId ? [row.actorId] : []));
  },

  async listDeliveries(dispatchId, filter, after, limit) {
    const t = MessageDeliveryTable;
    const conditions: SQL[] = [eq(t.dispatch_id, dispatchId)];
    if (filter.status) conditions.push(eq(t.status, filter.status as MessageDeliveryStatus));
    if (filter.channel) conditions.push(eq(t.channel, filter.channel));
    if (after) {
      conditions.push(or(gt(t.createdAt, after.createdAt), and(eq(t.createdAt, after.createdAt), gt(t.id, after.id)))!);
    }
    return db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(asc(t.createdAt), asc(t.id))
      .limit(limit);
  },

  async listDispatchUserIds(dispatchId, limit) {
    const t = MessageDeliveryTable;
    const rows = await db
      .selectDistinct({ userId: t.user_id })
      .from(t)
      .where(and(eq(t.dispatch_id, dispatchId), isNotNull(t.user_id)))
      .orderBy(asc(t.user_id))
      .limit(limit);
    return rows.flatMap((row) => (row.userId ? [row.userId] : []));
  },

  async userNames(userIds) {
    if (userIds.length === 0) return new Map();
    const rows = await db.select({ id: UserTable.id, name: UserTable.name }).from(UserTable).where(inArray(UserTable.id, [...userIds]));
    return new Map(rows.flatMap((row) => (row.name && row.name.trim() !== "" ? [[row.id, row.name] as [string, string]] : [])));
  },
};

export const drizzleSendResultsStore: SendResultsStore = {
  findDispatch: (id) => drizzleAdminDispatchStore.findDispatch(id),
  userNames: (userIds) => drizzleAdminDispatchStore.userNames(userIds),

  async listUndelivered(dispatchId, after, limit) {
    const t = MessageDeliveryTable;
    const conditions: SQL[] = [eq(t.dispatch_id, dispatchId), inArray(t.status, [...UNDELIVERED_STATUSES])];
    if (after) {
      conditions.push(or(gt(t.createdAt, after.createdAt), and(eq(t.createdAt, after.createdAt), gt(t.id, after.id)))!);
    }
    return db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(asc(t.createdAt), asc(t.id))
      .limit(limit);
  },
};

/** 既読した利用者: inApp の行(送信の受信者ごとの行と共有の行)の個々の既読 × 削除していない利用者。既読の新しい順 */
export const drizzleDispatchReadersStore: DispatchReadersStore = {
  findDispatch: (id) => drizzleAdminDispatchStore.findDispatch(id),

  async listReaders(dispatchId, after, limit) {
    const r = MessageInboxReadTable;
    const conditions: SQL[] = [eq(MessageInboxItemTable.dispatch_id, dispatchId), isNull(UserTable.deletedAt)];
    if (after) {
      conditions.push(or(lt(r.read_at, after.createdAt), and(eq(r.read_at, after.createdAt), lt(r.user_id, after.id)))!);
    }
    const rows = await db
      .select({ userId: r.user_id, name: UserTable.name, readAt: r.read_at })
      .from(r)
      .innerJoin(MessageInboxItemTable, eq(MessageInboxItemTable.id, r.item_id))
      .innerJoin(UserTable, eq(UserTable.id, r.user_id))
      .where(and(...conditions))
      .orderBy(desc(r.read_at), desc(r.user_id))
      .limit(limit);
    return rows.map((row) => ({ userId: row.userId, name: row.name && row.name.trim() !== "" ? row.name : null, readAt: row.readAt }));
  },
};
