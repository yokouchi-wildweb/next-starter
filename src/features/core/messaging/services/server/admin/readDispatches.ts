// src/features/core/messaging/services/server/admin/readDispatches.ts
//
// 回の読む口(D37。汎用 CRUD の search に乗せない): 回の一覧(期間・定義・種類・経路・状態、keyset)/ 回 1 件 / 回の配達(keyset)。
// 管理者を service でも確かめる。返す形は dispatchDto.ts。並び: 回は新しい順(created_at, id の降順)、配達は古い順(created_at, id の昇順)

import { z } from "zod";

import { DomainError } from "@/lib/errors";
import { MESSAGE_KINDS, type MessageCategory, type MessageKind } from "@/lib/messaging";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import { MESSAGE_DELIVERY_STATUSES, MESSAGE_DISPATCH_STATUSES } from "../../../entities/schema";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import { operationFlags, type DispatchPolicy } from "./operations";
import { ADMIN_SEND_MAX_USERS } from "./send";
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
  kind: z.enum(MESSAGE_KINDS).optional(),
  /** カテゴリーの鍵(画面は種別を選んだ後にその種別のカテゴリーから選ぶ。定義の鍵では絞らない、D46) */
  category: z.string().trim().min(1).max(100).optional(),
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
  /** 回の配達の利用者 id(重なりなし、limit まで) */
  listDispatchUserIds: (dispatchId: string, limit: number) => Promise<string[]>;
  /** 利用者の名前(users.name。id → 名前、名前の無い・消えた利用者は入らない) */
  userNames: (userIds: readonly string[]) => Promise<Map<string, string>>;
  listDeliveries: (
    dispatchId: string,
    filter: { status?: string; channel?: string },
    after: AdminCursor | null,
    limit: number,
  ) => Promise<MessageDelivery[]>;
};

export type AdminReadDeps = AdminCheckDeps & {
  dispatchStore: AdminDispatchStore;
  /** 送り元の表示名(受け口 sources → 同じ鍵の連絡の名前 → 一括の対象の「…の一括送信」、無ければ null。回の詳細は鍵を見せない、D46) */
  sourceLabel: (source: string) => Promise<string | null>;
  /** 回の操作の判定に要る値(連絡の性質と失敗の数) */
  operationInputs: (row: MessageDispatch) => Promise<{ policy: DispatchPolicy; counts: { failed: number; unknown: number } }>;
};

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
  const { policy, counts } = await deps.operationInputs(row);
  const [audienceUserIds, sourceLabel, names] = await Promise.all([
    audienceUserIdsOf(deps, row),
    deps.sourceLabel(row.source),
    row.actor_id ? deps.dispatchStore.userNames([row.actor_id]) : Promise.resolve(new Map<string, string>()),
  ]);
  return toDispatchDetail(row, operationFlags(row, policy, counts), {
    audienceUserIds,
    sourceLabel,
    actorName: row.actor_id ? (names.get(row.actor_id) ?? null) : null,
  });
}

/** 回の画面の絞りの選択肢: カテゴリー(受け口の全部、fork の物も)の鍵・表示名・種別。画面は種別ごとに並べる */
export type AdminDispatchCategoryOption = { key: string; label: string; kind: MessageKind };

export async function dispatchCategoryOptions(
  deps: AdminCheckDeps & { categories: Readonly<Record<string, MessageCategory>> },
): Promise<AdminDispatchCategoryOption[]> {
  await assertAdminActor(deps);
  return Object.values(deps.categories).map((category) => ({ key: category.key, label: category.label, kind: category.kind }));
}

/**
 * 選んだ利用者に送った回(audience.type = "recipients")の利用者 id(「同じ内容で送る」が同じ利用者を選んだ形で開くため)。
 * 回が宛先の一覧を持つ(予約・大きな送信)ならそこから、数だけの回(小さな送信)は配達の行から。
 * ADMIN_SEND_MAX_USERS を超える回・ほかの宛先の形は null(選び直し)
 */
export async function audienceUserIdsOf(deps: Pick<AdminReadDeps, "dispatchStore">, row: MessageDispatch): Promise<string[] | null> {
  const audience = (row.audience ?? null) as { type?: unknown; recipients?: unknown } | null;
  if (!audience || audience.type !== "recipients") return null;
  if (Array.isArray(audience.recipients)) {
    const ids = [
      ...new Set(
        audience.recipients.flatMap((recipient) => {
          const userId = (recipient as { userId?: unknown } | null)?.userId;
          return typeof userId === "string" && userId !== "" ? [userId] : [];
        }),
      ),
    ];
    return ids.length > 0 && ids.length <= ADMIN_SEND_MAX_USERS ? ids : null;
  }
  const ids = await deps.dispatchStore.listDispatchUserIds(row.id, ADMIN_SEND_MAX_USERS + 1);
  return ids.length > 0 && ids.length <= ADMIN_SEND_MAX_USERS ? ids : null;
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
  // 利用者の名前は 1 ページに 1 回だけ引く(id は見せない、D46)
  const ids = [...new Set(rows.slice(0, limit).flatMap((row) => (row.user_id ? [row.user_id] : [])))];
  const names = ids.length > 0 ? await deps.dispatchStore.userNames(ids) : new Map<string, string>();
  return page(rows, limit, (row) => toDeliveryRow(row, dispatch.record, row.user_id ? (names.get(row.user_id) ?? null) : null));
}
