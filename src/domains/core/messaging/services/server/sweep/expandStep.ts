// src/domains/core/messaging/services/server/sweep/expandStep.ts
//
// 大きな送信・全員・ロール・グループ宛ての送信を 1 束だけ展開する(cron と「続きを送る」が呼ぶ)。
// 再開の位置は message_dispatches.expand_cursor(null = まだ / keyset の印か "i:<番号>" = 途中 / MESSAGE_EXPAND_DONE = 終えた)。
// - 全員・ロール・グループ: 宛先の無い利用者は行を作らず skipped_no_address に数える。recipient_count に束の人数を足す
// - 選んだ宛先の一覧(target.type = "recipients"): 宛先の無い受信者は suppressed + no_address の行。見つからない利用者は recipient_count から引く
// - 配信停止(好み・宛先の停止)を当てる: 選んだ宛先は理由つきの suppressed の行、全員・ロール・グループは行を作らず suppressed に数える
// - 全員・ロール宛てのお知らせ(inApp)は、中身が受信者に依らなければ受信者ごとの行を作らず、最初の束で送信に 1 行の共有の
//   message_inbox_items(user_id null、target_roles = ロールか null)を書き、数は束ごとに targeted・sent へ足す(D32)。
//   共有の行は利用者ごとの inApp の好みを書く時には当てない(受け取り箱の利用者の API が送信の category で見る人の好みを当てる)
// - 送り始めの線(D58): 全員・ロールは送信の scheduled_at ?? createdAt 以前に登録した利用者だけ(それより後の登録は入らない)
// - グループ宛て(D58): 最初の 1 回で 1 文の INSERT … SELECT により 1 つの時点の一員(利用できる利用者・線以前の登録)を
//   送信の受信者の一覧へ書く(配達の行は作らない)。その後は一覧だけから束ごとに配達の行を作る(お知らせは受信者ごと、共有の行は作らない)。
//   固定の時にグループが使えない(門が閉・しまった・壊れた・版が無い・人数の上限・時間の上限)→ 送信を cancelled にし metadata.cancelReason に理由

import { DomainError } from "@/lib/errors";
import { listVariables } from "@/lib/templateVariables";

import type { MessageDispatch, MessageDispatchInsert, MessageInboxItemInsert } from "../../../entities/model";
import { MESSAGE_EXPAND_DONE, type MessageChannelCounts } from "../../../entities/schema";
import { inAppItemRow } from "@/domains/core/messaging/plugs/messagingChannels/inApp/createInAppChannel";
import { buildContent } from "../sendMessage/content";
import { toVariableMap } from "../sendMessage/context";
import { resolvedOfDispatch } from "../sendMessage/dispatchResolved";
import { deliveryEvents } from "../events/internalEvents";
import type { StopContext } from "../sendMessage/stops";
import {
  activeChannel,
  expandBroadcastChunk,
  expandExplicit,
  resolveTargetChunk,
  toDeliveryInsert,
  type ExpansionCounts,
  type PlannedDelivery,
} from "../sendMessage/expand";
import type { MessageRecipient, MessageSendDeps, MessageTargetSpec } from "../sendMessage/types";
import type { ExpansionWrite } from "./types";

type StoredTarget =
  | Exclude<MessageTargetSpec, { type: "group" }>
  | { type: "group"; groupId: string; version?: number | null }
  | {
      type: "recipients";
      recipients?: MessageRecipient[];
      recipientVars?: Record<string, Record<string, unknown>> | null;
    };

const INDEX_PREFIX = "i:";
/** グループ宛ての一覧の段の再開の位置("l:" = 一覧の最初から、"l:<利用者 id>" = その次から) */
const LIST_PREFIX = "l:";
const GROUPS_CLOSED = "ユーザーグループの機能が閉じています";
const FREEZE_TIMEOUT = "グループの一員の書き出しが時間内に終わりませんでした(条件を絞るか定期計算にしてください)";

/** 送り始めの線(予約は予約の時刻、他は送信を作った時刻) */
function sendStartOf(dispatch: MessageDispatch): Date {
  return dispatch.scheduled_at ?? dispatch.createdAt;
}

/** 配達の行を 1 つも作る前に送信を止める(グループの固定ができない時) */
function cancelPatch(dispatch: MessageDispatch, reason: string, now: Date): Partial<MessageDispatchInsert> {
  return {
    status: "cancelled",
    expand_cursor: MESSAGE_EXPAND_DONE,
    completed_at: now,
    metadata: { ...(dispatch.metadata ?? {}), cancelReason: reason },
    updatedAt: now,
  };
}

/** グループ宛ての最初の 1 回: 一員を送信の受信者の一覧へ 1 文で書く書き込み(書けなければ送信を止める) */
async function freezeGroup(
  deps: MessageSendDeps,
  dispatch: MessageDispatch,
  group: { groupId: string; version?: number | null },
  now: Date,
): Promise<ExpansionWrite> {
  try {
    if (!deps.groups || !deps.groups.enabled()) throw new DomainError(GROUPS_CLOSED, { status: 404 });
    const member = await deps.groups.memberWhere(group.groupId, { version: group.version ?? null });
    return {
      rows: [],
      freeze: {
        groupId: group.groupId,
        where: member.where,
        createdBefore: sendStartOf(dispatch),
        timeoutMs: member.timeoutMs,
        timeoutPatch: cancelPatch(dispatch, FREEZE_TIMEOUT, now),
      },
      patch: { expand_cursor: LIST_PREFIX, updatedAt: now },
    };
  } catch (error) {
    if (error instanceof DomainError) return { rows: [], patch: cancelPatch(dispatch, error.message, now) };
    throw error;
  }
}
const IN_APP = "inApp";
/** 受信者に依らない差し込みの鍵(送信の vars の鍵とこれだけなら共有の行にできる) */
const RECIPIENT_INDEPENDENT_CONTEXT = ["serviceName", "appBaseUrl"];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

/**
 * 全員・ロール宛てのお知らせの共有の行の中身(共有にできない時は null)。
 * 定義が読めない・レイアウトの欄の中身が受信者に依る鍵を使う・組めない → null(受信者ごとの行にする)
 */
async function sharedInAppContent(
  deps: MessageSendDeps,
  dispatch: MessageDispatch,
): Promise<Record<string, unknown> | null> {
  try {
    // 送信に残した物だけで描く(欄の中身が無い・読めなければ受信者ごとの行にする。送る時に止まる)
    if (!dispatch.values) return null;
    const loaded = await resolvedOfDispatch(deps, dispatch);
    if ("error" in loaded) return null;
    const { resolved } = loaded;
    // 差し込みの表 = 送信の vars(定義連絡の vars も DB のテンプレートの専用の値も 1 つの列、D202)
    const vars = (dispatch.vars ?? {}) as Record<string, unknown>;
    // throttle のある連絡の {{collapsedCount}} は共有の行では 1(全員・ロール宛ては間引かない)
    const throttleValues = resolved.throttle ? { collapsedCount: 1 } : {};
    const allowed = new Set([...Object.keys(vars), ...RECIPIENT_INDEPENDENT_CONTEXT, ...Object.keys(throttleValues)]);
    const keys = collectStrings(resolved.values).flatMap((text) => listVariables(text));
    if (keys.some((key) => !allowed.has(key))) return null;
    // 送る口と同じ組み立て(お知らせは要約から)
    const { content } = await buildContent(deps, resolved, IN_APP, toVariableMap({ ...vars, ...deps.context(), ...throttleValues }));
    return content;
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

/** 送信の展開の 1 束(書き込みの中身を返す。書くのは store の expandOne) */
export async function expandDispatchChunk(deps: MessageSendDeps, dispatch: MessageDispatch): Promise<ExpansionWrite> {
  const now = deps.now();
  const target = dispatch.target as StoredTarget | null;
  const channels = dispatch.channels;
  if (!target) {
    return { rows: [], patch: { expand_cursor: MESSAGE_EXPAND_DONE, updatedAt: now } };
  }

  // 大きな送信・全員・ロール・グループ宛てに required は来ない(送る口が拒む)
  const stops: StopContext = { kind: dispatch.kind, required: false, category: dispatch.category };
  let planned: PlannedDelivery[];
  let counts: ExpansionCounts;
  let nextCursor: string;
  let recipientCount = dispatch.recipient_count;
  let recipientVars: Record<string, Record<string, unknown>> | null = null;
  let inboxItem: MessageInboxItemInsert | undefined;
  let sharedSent = 0;

  if (target.type === "group" && dispatch.expand_cursor === null) return freezeGroup(deps, dispatch, target, now);

  if (target.type === "recipients") {
    const list = target.recipients ?? [];
    recipientVars = target.recipientVars ?? null;
    const cursor = dispatch.expand_cursor;
    const start = cursor?.startsWith(INDEX_PREFIX) ? Number(cursor.slice(INDEX_PREFIX.length)) || 0 : 0;
    const slice = list.slice(start, start + deps.config.expandChunkSize);
    const result = await expandExplicit(deps, { channels, recipients: slice, stops });
    planned = result.planned;
    counts = result.counts;
    // 見つからない利用者と、どの送信チャンネルでも止められた受信者を引く(D31)
    recipientCount -= result.unknownUserIds.length + result.stoppedRecipients;
    const end = start + slice.length;
    nextCursor = end >= list.length ? MESSAGE_EXPAND_DONE : `${INDEX_PREFIX}${end}`;
  } else {
    // グループは送信の受信者の一覧から、全員・ロールは送り始めの線以前の登録から
    const chunk =
      target.type === "group"
        ? await deps.store.listRecipientIds(dispatch.id, dispatch.expand_cursor?.slice(LIST_PREFIX.length) || null, deps.config.expandChunkSize)
        : await resolveTargetChunk(deps, target, dispatch.expand_cursor, { createdBefore: sendStartOf(dispatch) });
    const userCount = new Set(chunk.userIds).size;
    // 全員・ロール宛てのお知らせは共有の 1 行にできるか(中身が受信者に依らない)
    const shared =
      (target.type === "all" || target.type === "role") &&
      channels.includes(IN_APP) &&
      activeChannel(deps.channels, IN_APP)
        ? await sharedInAppContent(deps, dispatch)
        : null;
    const perRecipientChannels = shared ? channels.filter((key) => key !== IN_APP) : channels;
    const result = await expandBroadcastChunk(deps, { channels: perRecipientChannels, userIds: chunk.userIds, stops });
    planned = result.planned;
    counts = result.counts;
    if (shared) {
      counts[IN_APP] = { targeted: userCount, skippedNoAddress: 0, suppressed: 0 };
      sharedSent = userCount;
      if (dispatch.expand_cursor === null) {
        // 共有の行も要約の列 + レイアウト・欄の中身(記録の段に依らず残す、D120。秘密の鍵は送信の vars に無いので差し込まれない)
        inboxItem = {
          ...inAppItemRow(shared, { dispatchId: dispatch.id, userId: null, now }),
          target_roles: target.type === "role" ? [...target.roles] : null,
        };
      }
    }
    // どの送信チャンネルでも止められた利用者は数えない(共有のお知らせが届く送信では全員に届くので引かない、D31)
    recipientCount += userCount - (shared ? 0 : result.stoppedUserIds.size);
    nextCursor = chunk.nextCursor === null ? MESSAGE_EXPAND_DONE : target.type === "group" ? `${LIST_PREFIX}${chunk.nextCursor}` : chunk.nextCursor;
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
    // 止めた行(選んだ宛先の宛先なし・好み・宛先の停止)は delivery.suppressed(配達の行と同じ取引で)
    ...(deps.eventTypes && deps.eventTypes.size > 0
      ? { eventsFor: (created) => deliveryEvents(deps.eventTypes!, created, dispatch.message_key, now) }
      : {}),
    patch: {
      expand_cursor: nextCursor,
      channel_counts: channelCounts,
      recipient_count: Math.max(0, recipientCount),
      updatedAt: now,
    },
  };
}
