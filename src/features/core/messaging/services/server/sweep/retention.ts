// src/features/core/messaging/services/server/sweep/retention.ts
//
// 保持の掃除(cron messaging-retention)。messaging の config の日数を過ぎた行を予算の中で消す(D33):
// events → deliveries → dispatches(お知らせが参照する回・processing / scheduled の回は残す。消す前に冪等の鍵を
// message_idempotency_keys へ移す)→ 移した鍵(idempotencyKeyDays が null なら消さない)

import type { MessagingConfig } from "../../../config";
import type { MessageRetentionStore } from "./types";

export type RetentionResult = {
  events: number;
  deliveries: number;
  dispatches: number;
  movedKeys: number;
  idempotencyKeys: number;
  truncated: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function pruneMessaging(
  store: MessageRetentionStore,
  params: { config: MessagingConfig; now: Date; deadline: Date },
): Promise<RetentionResult> {
  const { retention } = params.config;
  const limit = retention.chunkSize;
  const before = (days: number) => new Date(params.now.getTime() - days * DAY_MS);
  const result: RetentionResult = { events: 0, deliveries: 0, dispatches: 0, movedKeys: 0, idempotencyKeys: 0, truncated: false };
  const inBudget = () => Date.now() < params.deadline.getTime();

  /** 1 文 = 最大 limit 行。満たない束が出るまで、予算の中で繰り返す */
  const drain = async (step: () => Promise<number>): Promise<number> => {
    let total = 0;
    while (inBudget()) {
      const deleted = await step();
      total += deleted;
      if (deleted < limit) return total;
    }
    result.truncated = true;
    return total;
  };

  result.events = await drain(() => store.deleteEventsBefore(before(retention.eventsDays), limit));
  result.deliveries = await drain(() => store.deleteDeliveriesBefore(before(retention.deliveriesDays), limit));
  result.dispatches = await drain(async () => {
    const { deleted, movedKeys } = await store.deleteDispatchesBefore(before(retention.dispatchesDays), limit);
    result.movedKeys += movedKeys;
    return deleted;
  });
  if (retention.idempotencyKeyDays !== null) {
    const days = retention.idempotencyKeyDays;
    result.idempotencyKeys = await drain(() => store.deleteIdempotencyKeysBefore(before(days), limit));
  }
  return result;
}
