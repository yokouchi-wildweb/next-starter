// src/features/core/messaging/services/server/sweep/expandStep.ts
//
// 大きな送信・audience の回を 1 束だけ展開する(cron と「続きを送る」が呼ぶ)。
// 再開の位置は message_dispatches.expand_cursor(null = まだ / keyset の印か "i:<番号>" = 途中 / MESSAGE_EXPAND_DONE = 終えた)。
// - audience(全員・ロール・audiences): 宛先の無い利用者は行を作らず skipped_no_address に数える。recipient_count に束の人数を足す
// - 選んだ宛先の一覧(audience.type = "recipients"): 宛先の無い受信者は suppressed + no_address の行。見つからない利用者は recipient_count から引く
// - 全員・ロール宛てのお知らせ(inApp)は、中身が受信者に依らなければ受信者ごとの行を作らず、最初の束で回に 1 行の共有の
//   message_inbox_items(user_id null、target_roles = ロールか null)を書き、数は束ごとに targeted・sent へ足す(D32)

import { listVariables } from "@/lib/structuredDocument/shared";

import type { MessageDispatch, MessageInboxItemInsert } from "../../../entities/model";
import { MESSAGE_EXPAND_DONE, type MessageChannelCounts } from "../../../entities/schema";
import { channelContent, renderValue, toVariableMap } from "../sendMessage/context";
import { resolveDefinition } from "../sendMessage/definition";
import {
  activeChannel,
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
const IN_APP = "inApp";
/** 受信者に依らない差し込みの鍵(回の vars の鍵とこれだけなら共有の行にできる) */
const RECIPIENT_INDEPENDENT_CONTEXT = ["serviceName", "appBaseUrl"];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

/**
 * 全員・ロール宛てのお知らせの共有の行の中身(共有にできない時は null)。
 * 定義が読めない・お知らせの中身が受信者に依る鍵を使う → null(受信者ごとの行にする)
 */
async function sharedInAppContent(
  deps: MessageSendDeps,
  dispatch: MessageDispatch,
): Promise<Record<string, unknown> | null> {
  const entry = dispatch.message_key ? deps.registry[dispatch.message_key] : undefined;
  if (!entry) return null;
  try {
    const { message } = await entry.definition();
    const resolved = await resolveDefinition(message, deps.registry, deps.channels, deps.enrichers);
    const content = channelContent(resolved, IN_APP, deps.channels[IN_APP]);
    const vars = (dispatch.vars ?? {}) as Record<string, unknown>;
    const allowed = new Set([...Object.keys(vars), ...RECIPIENT_INDEPENDENT_CONTEXT]);
    const keys = collectStrings(content).flatMap((text) => listVariables(text));
    if (keys.some((key) => !allowed.has(key))) return null;
    return renderValue(content, toVariableMap({ ...vars, ...deps.context() })) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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
  let inboxItem: MessageInboxItemInsert | undefined;
  let sharedSent = 0;

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
    const userCount = new Set(chunk.userIds).size;
    // 全員・ロール宛てのお知らせは共有の 1 行にできるか(中身が受信者に依らない)
    const shared =
      (audience.type === "all" || audience.type === "role") &&
      channels.includes(IN_APP) &&
      activeChannel(deps.channels, IN_APP)
        ? await sharedInAppContent(deps, dispatch)
        : null;
    const perRecipientChannels = shared ? channels.filter((key) => key !== IN_APP) : channels;
    const result = await expandBroadcastChunk(deps, { channels: perRecipientChannels, userIds: chunk.userIds });
    planned = result.planned;
    counts = result.counts;
    if (shared) {
      counts[IN_APP] = { targeted: userCount, skippedNoAddress: 0, suppressed: 0 };
      sharedSent = userCount;
      if (dispatch.expand_cursor === null) {
        inboxItem = {
          dispatch_id: dispatch.id,
          user_id: null,
          target_roles: audience.type === "role" ? [...audience.roles] : null,
          title: typeof shared.title === "string" ? shared.title : null,
          body: typeof shared.body === "string" ? shared.body : "",
          link: typeof shared.link === "string" ? shared.link : null,
          image: typeof shared.image === "string" ? shared.image : null,
          published_at: now,
        };
      }
    }
    recipientCount += userCount;
    nextCursor = chunk.nextCursor ?? MESSAGE_EXPAND_DONE;
  }

  const channelCounts = mergeCounts(channels, dispatch.channel_counts, counts);
  if (sharedSent > 0) channelCounts[IN_APP] = { ...channelCounts[IN_APP], sent: channelCounts[IN_APP].sent + sharedSent };

  return {
    rows: planned.map((plan) =>
      toDeliveryInsert(plan, {
        dispatchId: dispatch.id,
        now,
        vars: recipientVars?.[plan.recipientKey] ?? null,
      }),
    ),
    inboxItem,
    patch: {
      expand_cursor: nextCursor,
      channel_counts: channelCounts,
      recipient_count: Math.max(0, recipientCount),
      updatedAt: now,
    },
  };
}
