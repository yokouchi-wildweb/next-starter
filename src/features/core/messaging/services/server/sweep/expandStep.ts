// src/features/core/messaging/services/server/sweep/expandStep.ts
//
// 大きな送信・audience の回を 1 束だけ展開する(cron と「続きを送る」が呼ぶ)。
// 再開の位置は message_dispatches.expand_cursor(null = まだ / keyset の印か "i:<番号>" = 途中 / MESSAGE_EXPAND_DONE = 終えた)。
// - audience(全員・ロール・audiences): 宛先の無い利用者は行を作らず skipped_no_address に数える。recipient_count に束の人数を足す
// - 選んだ宛先の一覧(audience.type = "recipients"): 宛先の無い受信者は suppressed + no_address の行。見つからない利用者は recipient_count から引く

import type { MessageDispatch } from "../../../entities/model";
import { MESSAGE_EXPAND_DONE, type MessageChannelCounts } from "../../../entities/schema";
import {
  expandBroadcastChunk,
  expandExplicit,
  resolveAudienceChunk,
  toDeliveryInsert,
  type ExpansionCounts,
  type PlannedDelivery,
} from "../sendMessage/expand";
import type { MessageAudienceSpec, MessageRecipient, MessageSendDeps } from "../sendMessage/types";
import type { ExpansionWrite } from "./types";

type StoredAudience =
  | MessageAudienceSpec
  | {
      type: "recipients";
      recipients?: MessageRecipient[];
      recipientVars?: Record<string, Record<string, unknown>> | null;
    };

const INDEX_PREFIX = "i:";

function mergeCounts(
  channels: readonly string[],
  current: MessageChannelCounts | null,
  added: ExpansionCounts,
): MessageChannelCounts {
  const counts: MessageChannelCounts = { ...(current ?? {}) };
  for (const key of channels) {
    const base = counts[key] ?? {
      targeted: 0,
      sent: 0,
      failed: 0,
      skipped_no_address: 0,
      skipped_throttled: 0,
      suppressed: 0,
    };
    const more = added[key] ?? { targeted: 0, skippedNoAddress: 0, suppressed: 0 };
    counts[key] = {
      ...base,
      targeted: base.targeted + more.targeted,
      skipped_no_address: base.skipped_no_address + more.skippedNoAddress,
      suppressed: base.suppressed + more.suppressed,
    };
  }
  return counts;
}

/** 回の展開の 1 束(書き込みの中身を返す。書くのは store の expandOne) */
export async function expandDispatchChunk(deps: MessageSendDeps, dispatch: MessageDispatch): Promise<ExpansionWrite> {
  const now = deps.now();
  const audience = dispatch.audience as StoredAudience | null;
  const channels = dispatch.channels;
  if (!audience) {
    return { rows: [], patch: { expand_cursor: MESSAGE_EXPAND_DONE, updatedAt: now } };
  }

  let planned: PlannedDelivery[];
  let counts: ExpansionCounts;
  let nextCursor: string;
  let recipientCount = dispatch.recipient_count;
  let recipientVars: Record<string, Record<string, unknown>> | null = null;

  if (audience.type === "recipients") {
    const list = audience.recipients ?? [];
    recipientVars = audience.recipientVars ?? null;
    const cursor = dispatch.expand_cursor;
    const start = cursor?.startsWith(INDEX_PREFIX) ? Number(cursor.slice(INDEX_PREFIX.length)) || 0 : 0;
    const slice = list.slice(start, start + deps.config.expandChunkSize);
    const result = await expandExplicit(deps, { channels, recipients: slice });
    planned = result.planned;
    counts = result.counts;
    recipientCount -= result.unknownUserIds.length;
    const end = start + slice.length;
    nextCursor = end >= list.length ? MESSAGE_EXPAND_DONE : `${INDEX_PREFIX}${end}`;
  } else {
    const chunk = await resolveAudienceChunk(deps, audience, dispatch.expand_cursor);
    const result = await expandBroadcastChunk(deps, { channels, userIds: chunk.userIds });
    planned = result.planned;
    counts = result.counts;
    recipientCount += new Set(chunk.userIds).size;
    nextCursor = chunk.nextCursor ?? MESSAGE_EXPAND_DONE;
  }

  return {
    rows: planned.map((plan) =>
      toDeliveryInsert(plan, {
        dispatchId: dispatch.id,
        now,
        vars: recipientVars?.[plan.recipientKey] ?? null,
      }),
    ),
    patch: {
      expand_cursor: nextCursor,
      channel_counts: mergeCounts(channels, dispatch.channel_counts, counts),
      recipient_count: Math.max(0, recipientCount),
      updatedAt: now,
    },
  };
}
