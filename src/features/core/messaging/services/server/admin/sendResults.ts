// src/features/core/messaging/services/server/admin/sendResults.ts
//
// 送信の結果の口(D214 (1)、指令 06 AMENDMENT 1): 送信 1 つの送信チャンネルごとの数と、届かなかった人と理由のページ送り(keyset)。
// 自由連絡・定義連絡・一括送信の結果に同じ口。送れる所(一覧の一括送信は門の外)で結果も見られるよう、門 messagingDispatches の外(管理者だけ)。
// 返すのは結果の材料だけで、送信の詳細(readDispatches.ts)の代わりにはしない。
// - 届かなかった行 = 配達の状態 failed / bounced / suppressed(canceled・unknown・queued・sending・sent・delivered は入れない)
// - reason = suppressed は配達の reason(no_address / preference / suppression / throttled / channel_off)、
//   failed / bounced は last_error の符号(dispatchDto の deliveryErrorCode、文は constants/deliveryErrors.ts)。provider の文と宛先は返さない
// - 並び: 配達の作った時刻・id の昇順(印は readDispatches と同じ形)

import { z } from "zod";

import { DomainError } from "@/lib/errors";

import type { MessageDelivery, MessageDeliveryStatus, MessageDispatch } from "../../../entities/model";
import type { MessageChannelCounts } from "../../../entities/schema";
import { assertAdminActor, type AdminCheckDeps } from "./assertAdmin";
import { deliveryErrorCode } from "./dispatchDto";
import { decodeCursor, encodeCursor, type AdminCursor, type AdminPage } from "./readDispatches";

/** 届かなかった配達の状態(失敗 = failed / bounced、送らなかった = suppressed) */
export const UNDELIVERED_STATUSES = ["failed", "bounced", "suppressed"] as const satisfies readonly MessageDeliveryStatus[];
export type UndeliveredStatus = (typeof UNDELIVERED_STATUSES)[number];

export const SendResultsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type SendResultsQuery = z.input<typeof SendResultsQuerySchema>;

/** 届かなかった 1 行(利用者 × 送信チャンネル) */
export type AdminSendResultFailure = {
  userId: string | null;
  /** 利用者の名前(users.name。無い・消えた利用者は null) */
  name: string | null;
  channel: string;
  status: UndeliveredStatus;
  /** 理由の符号(suppressed は配達の reason、failed / bounced は last_error の符号。分からなければ null) */
  reason: string | null;
};

export type AdminSendResults = {
  /** 送信チャンネルごとの数(送信の channel_counts。まだ数の無い送信は {}) */
  channels: MessageChannelCounts;
  failed: AdminPage<AdminSendResultFailure>;
};

/** 結果の口の DB(テストは偽物を渡す) */
export type SendResultsStore = {
  findDispatch: (id: string) => Promise<MessageDispatch | null>;
  /** 送信の届かなかった配達(UNDELIVERED_STATUSES、作った時刻・id の昇順、after の次から limit まで) */
  listUndelivered: (dispatchId: string, after: AdminCursor | null, limit: number) => Promise<MessageDelivery[]>;
  /** 利用者の名前(id → 名前、名前の無い・消えた利用者は入らない) */
  userNames: (userIds: readonly string[]) => Promise<Map<string, string>>;
};

export type SendResultsDeps = AdminCheckDeps & { sendResultsStore: SendResultsStore };

function failureOf(row: MessageDelivery, names: Map<string, string>): AdminSendResultFailure {
  const status = row.status as UndeliveredStatus;
  return {
    userId: row.user_id,
    name: row.user_id ? (names.get(row.user_id) ?? null) : null,
    channel: row.channel,
    status,
    reason: status === "suppressed" ? (row.reason ?? null) : deliveryErrorCode(row),
  };
}

/** 送信の結果。@throws DomainError(404) 送信が無い・削除した送信 / (400) 条件が不正 / (403) 管理者でない */
export async function sendResults(deps: SendResultsDeps, dispatchId: string, query: SendResultsQuery = {}): Promise<AdminSendResults> {
  await assertAdminActor(deps);
  const parsed = SendResultsQuerySchema.safeParse(query ?? {});
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "条件が不正です", { status: 400 });
  const { cursor, limit } = parsed.data;
  const after = cursor ? decodeCursor(cursor) : null;
  const dispatch = await deps.sendResultsStore.findDispatch(dispatchId);
  if (!dispatch || dispatch.deleted_at) throw new DomainError("送信が見つかりません", { status: 404 });

  const rows = await deps.sendResultsStore.listUndelivered(dispatchId, after, limit + 1);
  const items = rows.slice(0, limit);
  // 利用者の名前は 1 ページに 1 回だけ引く
  const ids = [...new Set(items.flatMap((row) => (row.user_id ? [row.user_id] : [])))];
  const names = ids.length > 0 ? await deps.sendResultsStore.userNames(ids) : new Map<string, string>();
  return {
    channels: dispatch.channel_counts ?? {},
    failed: {
      items: items.map((row) => failureOf(row, names)),
      nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]!) : null,
    },
  };
}
