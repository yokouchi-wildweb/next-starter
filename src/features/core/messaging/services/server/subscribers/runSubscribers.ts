// src/features/core/messaging/services/server/subscribers/runSubscribers.ts
//
// 購読の cron(messaging-subscribers、D47)。購読ごとに印(message_subscriber_cursors)から seq 順に事件を読み、handle へ渡す。
// - 読むのは created_at が now − lagSeconds より前の事件だけ(seq は insert の順で commit の順ではない。遅れて commit した取引を
//   飛ばさない余白。lag より長く commit が遅れた取引の事件は飛ぶことがある)
// - on(種類)と filter(連絡の鍵・経路)に合う事件だけを batchSize ずつ。成功で印を進める(少なくとも 1 回 = 同じ事件が 2 回渡ることがある。
//   handle は事件の id で冪等にする)
// - 束が失敗したら 1 件ずつ渡し直して失敗した事件を見つける: それより前は済み、失敗した事件は attempts++ して印を進めず次の実行へ。
//   同じ事件が maxAttempts 回失敗したら隔離して(quarantined_at)印を進める。隔離した事件は reprocessQuarantined で渡し直せる
// - 合う事件を読み切ったら、合わなかった事件も含め上限(lag より前の一番大きい seq)まで印を進める(保持の掃除を止めない)
// - runBudgetedBatches + 締切(config.subscribers.budgetMs)

import type { MessageSubscriber } from "@/lib/messaging";
import { runBudgetedBatches } from "@/lib/cron";

import type { MessagingConfig } from "../../../config";
import type { SubscriberEvent, SubscriberStore } from "./types";

export type SubscriberRunDeps = {
  store: SubscriberStore;
  subscribers: Readonly<Record<string, MessageSubscriber>>;
  config: Pick<MessagingConfig, "subscribers">;
  now: () => Date;
};

export type SubscriberRunResult = {
  subscribers: number;
  delivered: number;
  failed: number;
  quarantined: number;
  /** 締切で残した購読がある */
  truncated: boolean;
};

/** 失敗した事件で止まった印(runBudgetedBatches を抜ける合図) */
class StopAtFailure extends Error {
  constructor() {
    super("stop at failure");
  }
}

const ERROR_MAX = 500;

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, ERROR_MAX);
}

/** 購読 1 つを締切まで進める */
async function runOne(
  deps: SubscriberRunDeps,
  subscriber: MessageSubscriber,
  deadline: Date,
  result: SubscriberRunResult,
): Promise<void> {
  const { lagSeconds, batchSize, maxAttempts } = deps.config.subscribers;
  const start = await deps.store.getMark(subscriber.key);
  const upper = await deps.store.upperSeq(new Date(deps.now().getTime() - lagSeconds * 1000));
  if (upper <= start) return;

  /** 1 件ずつ渡し直す。全部済めば true、印を止める失敗があれば false */
  const oneByOne = async (events: readonly SubscriberEvent[]): Promise<boolean> => {
    for (const event of events) {
      try {
        await subscriber.handle([event]);
        await deps.store.clearFailures(subscriber.key, [event.id]);
        await deps.store.advanceMark(subscriber.key, event.seq);
        result.delivered += 1;
      } catch (error) {
        result.failed += 1;
        const failure = await deps.store.recordFailure({
          subscriberKey: subscriber.key,
          eventId: event.id,
          error: errorText(error),
          maxAttempts,
          now: deps.now(),
        });
        if (!failure.quarantined) return false;
        // 上限に達した事件は隔離して先へ進む
        result.quarantined += 1;
        await deps.store.advanceMark(subscriber.key, event.seq);
      }
    }
    return true;
  };

  try {
    const run = await runBudgetedBatches<SubscriberEvent, number>({
      deadline,
      fetchNext: async (cursor) => {
        const items = await deps.store.fetchEvents({
          after: cursor ?? start,
          upTo: upper,
          types: subscriber.on.map(String),
          messages: subscriber.filter?.messages,
          channels: subscriber.filter?.channels,
          limit: batchSize,
        });
        if (items.length === 0) return null;
        return { items, cursor: items[items.length - 1].seq, done: items.length < batchSize };
      },
      processChunk: async (items) => {
        try {
          await subscriber.handle(items);
          await deps.store.clearFailures(
            subscriber.key,
            items.map((event) => event.id),
          );
          result.delivered += items.length;
        } catch {
          if (!(await oneByOne(items))) throw new StopAtFailure();
        }
      },
      onChunkDone: ({ cursor }) => deps.store.advanceMark(subscriber.key, cursor),
    });
    if (run.exhausted) {
      // 合う事件を読み切った: 合わなかった事件も含め上限まで進める
      await deps.store.advanceMark(subscriber.key, upper);
    } else if (run.budgetExhausted) {
      result.truncated = true;
    }
  } catch (error) {
    if (!(error instanceof StopAtFailure)) throw error;
  }
}

/** 全部の購読を 1 回進める */
export async function runSubscribers(deps: SubscriberRunDeps, options: { deadline: Date }): Promise<SubscriberRunResult> {
  const list = Object.values(deps.subscribers).filter((subscriber) => subscriber.on.length > 0);
  const result: SubscriberRunResult = { subscribers: list.length, delivered: 0, failed: 0, quarantined: 0, truncated: false };
  for (const subscriber of list) {
    if (Date.now() >= options.deadline.getTime()) {
      result.truncated = true;
      break;
    }
    try {
      await runOne(deps, subscriber, options.deadline, result);
    } catch (error) {
      // 1 つの購読の DB の誤りで他の購読を止めない
      console.error(`[messaging] 購読 ${subscriber.key} を進められませんでした: ${errorText(error)}`);
    }
  }
  return result;
}

export type ReprocessResult = { reprocessed: number; failed: number };

/**
 * 隔離した事件を購読へ 1 件ずつ渡し直す(運用の関数)。成功した事件は失敗の行を消し、失敗した事件は attempts++(隔離のまま)。
 * @throws Error 購読が無い
 */
export async function reprocessQuarantined(
  deps: SubscriberRunDeps,
  subscriberKey: string,
  eventIds?: readonly string[],
): Promise<ReprocessResult> {
  const subscriber = deps.subscribers[subscriberKey];
  if (!subscriber) throw new Error(`購読 ${subscriberKey} がありません`);
  const ids = await deps.store.listQuarantined(subscriberKey, eventIds);
  const events = (await deps.store.findEvents(ids)).sort((a, b) => a.seq - b.seq);
  const result: ReprocessResult = { reprocessed: 0, failed: 0 };
  for (const event of events) {
    try {
      await subscriber.handle([event]);
      await deps.store.clearFailures(subscriberKey, [event.id]);
      result.reprocessed += 1;
    } catch (error) {
      result.failed += 1;
      await deps.store.recordFailure({
        subscriberKey,
        eventId: event.id,
        error: errorText(error),
        maxAttempts: deps.config.subscribers.maxAttempts,
        now: deps.now(),
      });
    }
  }
  return result;
}
