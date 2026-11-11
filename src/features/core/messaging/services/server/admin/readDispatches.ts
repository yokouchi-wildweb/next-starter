// src/features/core/messaging/services/server/admin/readDispatches.ts
//
// 回の読む口(D37。汎用 CRUD の search に乗せない): 回の一覧(期間・定義・種類・経路・状態、keyset)/ 回 1 件 / 回の配達(keyset)。
// 管理者を service でも確かめる。返す形は dispatchDto.ts。並び: 回は新しい順(created_at, id の降順)、配達は古い順(created_at, id の昇順)

import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import { MESSAGE_DELIVERY_STATUSES, MESSAGE_DISPATCH_STATUSES } from "../../../entities/schema";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import { toDeliveryRow, toDispatchDetail, toDispatchSummary, type AdminDeliveryRow, type AdminDispatchDetail, type AdminDispatchSummary } from "./dispatchDto";

/** keyset の印(時刻 + id。中身は組み立てずに次の呼び出しへそのまま渡す) */
export type AdminCursor = { createdAt: Date; id: string };

export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

/** @throws DomainError(400) 読めない印 */
export function decodeCursor(cursor: string): AdminCursor {
  const [time, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(time ?? "");
  if (!id || Number.isNaN(createdAt.getTime())) throw new DomainError("cursor が不正です", { status: 400 });
  return { createdAt, id };
}

const limitSchema = z.coerce.number().int().min(1).max(100).default(50);

export const ListDispatchesQuerySchema = z.object({
  /** 期間(作った時刻、from 以上 to 未満) */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  messageKey: z.string().trim().min(1).optional(),
  kind: z.enum(["transactional", "marketing", "activity"]).optional(),
  channel: z.string().trim().min(1).optional(),
  status: z.enum(MESSAGE_DISPATCH_STATUSES).optional(),
  cursor: z.string().min(1).optional(),
  limit: limitSchema,
});
export type ListDispatchesQuery = z.input<typeof ListDispatchesQuerySchema>;

export const ListDeliveriesQuerySchema = z.object({
  status: z.enum(MESSAGE_DELIVERY_STATUSES).optional(),
  channel: z.string().trim().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: limitSchema,
});
export type ListDeliveriesQuery = z.input<typeof ListDeliveriesQuerySchema>;

/** 読む口の DB(テストは偽物を渡す) */
export type AdminDispatchStore = {
  listDispatches: (
    filter: Omit<z.output<typeof ListDispatchesQuerySchema>, "cursor" | "limit">,
    after: AdminCursor | null,
    limit: number,
  ) => Promise<MessageDispatch[]>;
  findDispatch: (id: string) => Promise<MessageDispatch | null>;
  listDeliveries: (
    dispatchId: string,
    filter: { status?: string; channel?: string },
    after: AdminCursor | null,
    limit: number,
  ) => Promise<MessageDelivery[]>;
};

export type AdminReadDeps = AdminCheckDeps & { dispatchStore: AdminDispatchStore };

export type AdminPage<T> = { items: T[]; nextCursor: string | null };

function parseQuery<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value ?? {});
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "条件が不正です", { status: 400 });
  return parsed.data;
}

function page<R extends { createdAt: Date; id: string }, T>(rows: R[], limit: number, map: (row: R) => T): AdminPage<T> {
  const items = rows.slice(0, limit);
  return { items: items.map(map), nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null };
}

/** 回の一覧(新しい順) */
export async function listDispatches(deps: AdminReadDeps, query: ListDispatchesQuery = {}): Promise<AdminPage<AdminDispatchSummary>> {
  await assertAdminActor(deps);
  const { cursor, limit, ...filter } = parseQuery(ListDispatchesQuerySchema, query);
  const rows = await deps.dispatchStore.listDispatches(filter, cursor ? decodeCursor(cursor) : null, limit + 1);
  return page(rows, limit, toDispatchSummary);
}

/** @throws DomainError(404) */
export async function findDispatch(deps: AdminReadDeps, id: string): Promise<AdminDispatchDetail> {
  await assertAdminActor(deps);
  const row = await deps.dispatchStore.findDispatch(id);
  if (!row) throw new DomainError("送信記録が見つかりません", { status: 404 });
  return toDispatchDetail(row);
}

/** 回の配達(古い順)。@throws DomainError(404) 回が無い */
export async function listDeliveries(
  deps: AdminReadDeps,
  dispatchId: string,
  query: ListDeliveriesQuery = {},
): Promise<AdminPage<AdminDeliveryRow>> {
  await assertAdminActor(deps);
  const { cursor, limit, ...filter } = parseQuery(ListDeliveriesQuerySchema, query);
  const dispatch = await deps.dispatchStore.findDispatch(dispatchId);
  if (!dispatch) throw new DomainError("送信記録が見つかりません", { status: 404 });
  const rows = await deps.dispatchStore.listDeliveries(dispatchId, filter, cursor ? decodeCursor(cursor) : null, limit + 1);
  return page(rows, limit, (row) => toDeliveryRow(row, dispatch.record));
}
