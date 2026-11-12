// src/features/core/messaging/services/server/sendMessage/throttle.ts
//
// 会話の間引き(D48)。定義の throttle { by, mode, seconds } を、経路の send の前に受信者ごとに当てる(要求の中の送りと cron の送りの両方)。
// - 間引きの鍵 = 受信者の鍵 × message_key × by の値(回の vars)の sha256
// - 判定は鍵の lock(本物は pg_advisory_xact_lock)を持った取引の中で、回 × 受信者の配達の行を読み直してから 1 度だけ行い、
//   その受信者の全部の行に書く(throttle_key が入った行 = 決めた行。後の束・cron は判定し直さず、決めた状態に従う)
// - untilRead(経路に inApp がある): 同じ鍵の未読の受信者ごとのお知らせがあれば置き換える(中身を最新に、collapsed_count + 1、
//   前の回を collapsed_dispatch_ids に足し dispatch_id は今の回、published_at = 今 = 未読のまま上に出る)。
//   inApp の行は sent + reason throttled、他の経路の行は suppressed + throttled(回の skipped_throttled に数える)
// - window(と inApp が経路に無い untilRead): 同じ鍵の前の送り(他の回・reason なしで seconds 以内に sent、か送る途中)があれば、
//   inApp は未読の行があれば置き換え・無ければ新しい行、他の経路は throttled
// - 間引かない時(最初の 1 通・window の後・既読の後): inApp の行はこの取引の中で新しいお知らせ(鍵つき・回数 1)を書いて sent、
//   他の経路の行は throttle_key だけ入れて普通に送る(後から来た同じ鍵の送りがこの行・このお知らせを見て間引く)
// - お知らせは経路の send を通さずにここで書く(lock を経路の呼び出しの間持たないため)。行の形は channels/inApp の inAppItemRow
// - 全員・ロール宛ての回(共有の 1 行)は間引かない(どの経路も)。audiences の項目と選んだ宛先の回は間引く

import { createHash } from "node:crypto";

import type { MessageDeliveryInsert, MessageDeliveryReason, MessageDeliveryStatus } from "../../../entities/model";
import { inAppItemRow } from "../../../channels/inApp/createInAppChannel";
import { deliveryEvents } from "../events/internalEvents";
import { channelContent, renderValue, toVariableMap } from "./context";
import type { AnyResolvedMessageDefinition } from "./definition";
import type { DeliveryJob } from "./deliver";
import { activeChannel } from "./expand";
import type { RecordPolicy } from "./record";
import type { MessageSendDeps, MessageThrottleTx, ThrottleDeliveryRow } from "./types";

const IN_APP = "inApp";
/** 送り方を決める前の行(要求の中は queued、cron が取った行は sending) */
const OPEN_STATUSES: readonly string[] = ["queued", "sending"];

/** 間引きの鍵(受信者 × message_key × by の値) */
export function throttleKeyOf(recipientKey: string, messageKey: string, by: readonly string[], vars: Readonly<Record<string, unknown>>): string {
  const payload = JSON.stringify([recipientKey, messageKey, by.map((key) => vars[key] ?? null)]);
  return createHash("sha256").update(payload).digest("hex");
}

/** 送る前の行 1 つ(values = 描いた時の差し込む値。お知らせを回数つきで描き直す) */
export type ThrottleJob = { job: DeliveryJob; values: Record<string, unknown> };

/** 間引きが書いた・読み直した行の状態(呼び手が数えて、自分の書き込みを飛ばす) */
export type ThrottleDecided = {
  deliveryId: string;
  channel: string;
  status: MessageDeliveryStatus;
  reason: MessageDeliveryReason | null;
};

export type ThrottleResult = {
  /** 経路の send に渡す残り */
  jobs: DeliveryJob[];
  /** 間引きが状態を決めた行(この束の外の同じ受信者の行も含む) */
  decided: ThrottleDecided[];
};

/** 間引くか(定義の throttle・部品・回の宛て方) */
export function throttleApplies(
  deps: MessageSendDeps,
  resolved: AnyResolvedMessageDefinition,
  audienceType: string | null | undefined,
): boolean {
  return Boolean(resolved.throttle && deps.throttle && audienceType !== "all" && audienceType !== "role");
}

/**
 * 経路の send の前に間引きを当てる。throttle の無い連絡・全員・ロール宛ての回はそのまま返す。
 */
export async function applyThrottle(
  deps: MessageSendDeps,
  params: {
    dispatchId: string;
    audienceType: string | null | undefined;
    resolved: AnyResolvedMessageDefinition;
    /** 回の vars(by の値) */
    vars: Readonly<Record<string, unknown>>;
    policy: RecordPolicy;
    jobs: readonly ThrottleJob[];
  },
): Promise<ThrottleResult> {
  const { dispatchId, resolved, vars, policy } = params;
  const throttle = resolved.throttle;
  const store = deps.throttle;
  if (!throttle || !store || !throttleApplies(deps, resolved, params.audienceType)) {
    return { jobs: params.jobs.map((entry) => entry.job), decided: [] };
  }

  const byRecipient = new Map<string, ThrottleJob[]>();
  for (const entry of params.jobs) {
    byRecipient.set(entry.job.recipientKey, [...(byRecipient.get(entry.job.recipientKey) ?? []), entry]);
  }

  const kept: DeliveryJob[] = [];
  const decided: ThrottleDecided[] = [];
  for (const [recipientKey, group] of byRecipient) {
    const key = throttleKeyOf(recipientKey, resolved.key, throttle.by, vars);
    const rows = await store.withKey(key, (tx) =>
      decideRecipient(deps, tx, { key, dispatchId, recipientKey, resolved, policy, group }),
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const entry of group) {
      const row = byId.get(entry.job.deliveryId);
      // 読み直した行がまだ送る途中なら送る(普通の送り)。決まった行は送らない
      if (!row || OPEN_STATUSES.includes(row.status)) kept.push(entry.job);
    }
    for (const row of rows) {
      if (!OPEN_STATUSES.includes(row.status)) {
        decided.push({ deliveryId: row.id, channel: row.channel, status: row.status, reason: row.reason });
      }
    }
  }
  return { jobs: kept, decided };
}

/** 鍵の lock の中: 受信者の行を読み直し、まだ決めていなければ決めて書く。返値 = 書いた後の受信者の行 */
async function decideRecipient(
  deps: MessageSendDeps,
  tx: MessageThrottleTx,
  params: {
    key: string;
    dispatchId: string;
    recipientKey: string;
    resolved: AnyResolvedMessageDefinition;
    policy: RecordPolicy;
    group: readonly ThrottleJob[];
  },
): Promise<ThrottleDeliveryRow[]> {
  const { key, dispatchId, recipientKey, resolved, policy, group } = params;
  const throttle = resolved.throttle!;
  const rows = await tx.recipientRows(dispatchId, recipientKey);
  // 他の束・他の処理がもう決めた(鍵の入った行がある)
  if (rows.some((row) => row.throttle_key !== null)) return rows;

  const now = deps.now();
  const open = rows.filter((row) => OPEN_STATUSES.includes(row.status));
  if (open.length === 0) return rows;
  const userId = group.find((entry) => entry.job.userId)?.job.userId ?? null;
  const inAppRow =
    userId && activeChannel(deps.channels, IN_APP) ? (open.find((row) => row.channel === IN_APP) ?? null) : null;

  const item = inAppRow && userId ? await tx.findUnreadItem(userId, key) : null;
  const throttled =
    throttle.mode === "untilRead" && inAppRow
      ? item !== null
      : await tx.hasWindowAnchor(key, dispatchId, new Date(now.getTime() - throttle.seconds * 1000));

  const types = deps.eventTypes ?? new Set<string>();
  const events = (row: ThrottleDeliveryRow, status: string, reason: string | null) =>
    deliveryEvents(types, [{ id: row.id, dispatch_id: row.dispatch_id, channel: row.channel, status, reason }], resolved.key, now);
  const release = { next_attempt_at: null, locked_until: null, lock_token: null, updatedAt: now };
  const finalVars = policy.keepVars ? {} : { vars: null };
  const written = new Map<string, Pick<ThrottleDeliveryRow, "status" | "reason" | "throttle_key">>();

  if (inAppRow && userId) {
    const replace = throttled && item !== null;
    const count = replace ? item.collapsed_count + 1 : 1;
    const values = group[0]!.values;
    const content = renderValue(
      channelContent(resolved, IN_APP, deps.channels[IN_APP]),
      toVariableMap({ ...values, collapsedCount: count }),
    ) as Record<string, unknown>;
    const row = { ...inAppItemRow(content, { dispatchId, userId, now }), throttle_key: key, collapsed_count: count };
    if (replace) {
      const earlier = item.collapsed_dispatch_ids ?? [];
      await tx.replaceItem(item.id, {
        dispatch_id: dispatchId,
        title: row.title,
        body: row.body,
        link: row.link,
        image: row.image,
        published_at: now,
        collapsed_count: count,
        collapsed_dispatch_ids: item.dispatch_id === dispatchId || earlier.includes(item.dispatch_id) ? earlier : [...earlier, item.dispatch_id],
        updatedAt: now,
      });
    } else {
      await tx.insertItem(row);
    }
    // window の間の新しいお知らせ(既読の後)も throttled: 起点にしない(会話が続いても window が延びない)
    const reason: MessageDeliveryReason | null = throttled ? "throttled" : null;
    const patch: Partial<MessageDeliveryInsert> = {
      ...release,
      ...finalVars,
      status: "sent",
      reason,
      attempts: inAppRow.attempts + 1,
      provider: IN_APP,
      provider_message_id: null,
      last_error: null,
      sent_at: now,
      throttle_key: key,
      ...(policy.keepRecipientBody ? { body: content } : {}),
    };
    await tx.updateDelivery(inAppRow.id, patch, events(inAppRow, "sent", reason));
    written.set(inAppRow.id, { status: "sent", reason, throttle_key: key });
  }

  for (const row of open) {
    if (row.id === inAppRow?.id) continue;
    if (throttled) {
      await tx.updateDelivery(
        row.id,
        { ...release, ...finalVars, status: "suppressed", reason: "throttled", throttle_key: key },
        events(row, "suppressed", "throttled"),
      );
      written.set(row.id, { status: "suppressed", reason: "throttled", throttle_key: key });
    } else {
      // 送り方を決めた印(普通に送る。window の送る途中の起点にもなる)
      await tx.updateDelivery(row.id, { throttle_key: key });
      written.set(row.id, { status: row.status, reason: row.reason, throttle_key: key });
    }
  }
  return rows.map((row) => ({ ...row, ...(written.get(row.id) ?? {}) }));
}
