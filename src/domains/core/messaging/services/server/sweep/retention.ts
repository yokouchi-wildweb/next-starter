// src/domains/core/messaging/services/server/sweep/retention.ts
//
// 保持の掃除(cron messaging-retention)。messaging の config の日数を過ぎた行を予算の中で消す(D33):
// events(購読がある時は一番遅い印より新しい事件を残す、D47)→ 配達の重い列(deliveryContentDays を過ぎた配達の body・vars を null、行は残す)
// → deliveries(deliveriesDays を過ぎた行)→ dispatches(お知らせが参照する送信・processing / scheduled の送信は残す。消す前に冪等の鍵を
// message_idempotency_keys へ移し、送信に結んだお知らせの画像を保存の台帳から外す)→ 移した鍵(idempotencyKeyDays が null なら消さない)
// 各段は runBudgetedBatches(@/lib/cron)で回す。締切は全段で 1 つ(createDeadline、index.ts)

import { runBudgetedBatches } from "@/lib/cron";

import type { MessagingConfig } from "../../../config";
import type { MessageRetentionStore } from "./types";

export type RetentionResult = {
  events: number;
  /** body・vars を null にした配達の行の数 */
  deliveryContents: number;
  deliveries: number;
  dispatches: number;
  movedKeys: number;
  /** 消した送信から外したお知らせの画像(台帳の行)の数 */
  detachedImages: number;
  idempotencyKeys: number;
  truncated: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function pruneMessaging(
  store: MessageRetentionStore,
  params: {
    config: MessagingConfig;
    now: Date;
    deadline: Date;
    /** 購読の一番遅い印(null = 購読なし = 日数だけで消す) */
    slowestSubscriberMark?: number | null;
  },
): Promise<RetentionResult> {
  const { retention } = params.config;
  const limit = retention.chunkSize;
  const before = (days: number) => new Date(params.now.getTime() - days * DAY_MS);
  const result: RetentionResult = { events: 0, deliveryContents: 0, deliveries: 0, dispatches: 0, movedKeys: 0, detachedImages: 0, idempotencyKeys: 0, truncated: false };

  /**
   * 1 段を予算の中で回す。1 束 = 1 文(最大 limit 行)。fetchNext が文を実行して変えた行の数を束にし、processChunk は何もしない:
   * SKIP LOCKED の select と delete / update は 1 文のまま(select と書き込みを分けると間で行の排他が外れ、並走する処理と重なる)。
   * limit に満たない束 = 使い切り。締切で止まった段があれば truncated
   */
  const drain = async (step: () => Promise<number>): Promise<number> => {
    const run = await runBudgetedBatches<null, undefined>({
      deadline: params.deadline,
      fetchNext: async () => {
        const affected = await step();
        return { items: new Array<null>(affected).fill(null), cursor: undefined, done: affected < limit };
      },
      processChunk: async () => {},
    });
    if (run.budgetExhausted) result.truncated = true;
    return run.processed;
  };

  const maxSeq = params.slowestSubscriberMark ?? null;
  result.events = await drain(() => store.deleteEventsBefore(before(retention.eventsDays), limit, maxSeq));
  result.deliveryContents = await drain(() => store.clearDeliveryContentBefore(before(retention.deliveryContentDays), limit));
  result.deliveries = await drain(() => store.deleteDeliveriesBefore(before(retention.deliveriesDays), limit));
  result.dispatches = await drain(async () => {
    const { deleted, movedKeys, detachedImages } = await store.deleteDispatchesBefore(before(retention.dispatchesDays), limit);
    result.movedKeys += movedKeys;
    result.detachedImages += detachedImages;
    return deleted;
  });
  if (retention.idempotencyKeyDays !== null) {
    const days = retention.idempotencyKeyDays;
    result.idempotencyKeys = await drain(() => store.deleteIdempotencyKeysBefore(before(days), limit));
  }
  return result;
}
