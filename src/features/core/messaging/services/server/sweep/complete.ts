// src/features/core/messaging/services/server/sweep/complete.ts
//
// 展開と送信を終えた回を閉じる: 経路ごとの sent / failed を配達の行から数え直し、
// status を completed / completed_with_failures、completed_at を埋め、record meta なら送るために置いた vars を消す。

import type { MessageChannelCounts } from "../../../entities/schema";
import { dispatchCompletedEvent } from "../events/internalEvents";
import type { MessageSweepDeps } from "./types";

const FAILED = ["failed", "bounced", "unknown"];

/** 終えられる回を閉じる(返値 = 閉じた数) */
export async function completeDispatches(
  deps: MessageSweepDeps,
  params: { limit: number; dispatchId?: string },
): Promise<number> {
  const dispatches = await deps.sweepStore.findCompletable(params.limit, params.dispatchId);
  for (const dispatch of dispatches) {
    const aggregate = await deps.sweepStore.aggregateDeliveries(dispatch.id);
    const counts: MessageChannelCounts = {};
    for (const key of dispatch.channels) {
      const base = dispatch.channel_counts?.[key] ?? {
        targeted: 0,
        sent: 0,
        failed: 0,
        skipped_no_address: 0,
        skipped_throttled: 0,
        suppressed: 0,
      };
      // 配達の行のある経路だけ数え直す(全員・ロール宛てのお知らせの共有の行は展開の時に数えた値のまま)
      const hasRows = aggregate.some((entry) => entry.channel === key);
      counts[key] = hasRows ? { ...base, sent: 0, failed: 0 } : { ...base };
    }
    let anyFailed = false;
    for (const { channel, status, count } of aggregate) {
      if (FAILED.includes(status)) anyFailed = true;
      if (!counts[channel]) continue;
      if (status === "sent" || status === "delivered") counts[channel].sent += count;
      if (status === "failed" || status === "bounced") counts[channel].failed += count;
    }
    const now = deps.now();
    const status = anyFailed ? "completed_with_failures" : "completed";
    // 回を閉じた事件(購読が聞いていれば、回の更新と同じ取引で)
    const event = dispatchCompletedEvent(deps.eventTypes ?? new Set(), dispatch, status, now, { isTest: dispatch.is_test ?? false });
    await deps.sweepStore.updateDispatch(
      dispatch.id,
      {
        status,
        channel_counts: counts,
        completed_at: now,
        updatedAt: now,
        ...(dispatch.record === "meta" ? { vars: null } : {}),
      },
      event ? [event] : [],
    );
  }
  return dispatches.length;
}
