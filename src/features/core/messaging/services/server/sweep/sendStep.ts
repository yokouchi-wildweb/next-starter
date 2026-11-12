// src/features/core/messaging/services/server/sweep/sendStep.ts
//
// cron が lease で取った配達の行を送る。中身は回の定義(生成の一覧の message_key)から描き直す:
// 回の vars + 行の受信者ごとの値 + enrichers + 共通の文脈。
// - 定義が一覧に無い・検査に落ちる → failed(reason の符号だけ)
// - 経路の項目が無い・enabled: false → suppressed + channel_off
// - 送る直前に配信停止を確かめ直す(好み・宛先の停止 → suppressed + reason。宛先の 1 つにもう送れた行は sent のまま)
// - 送った後の行の受信者ごとの値は回の record に従う(meta なら消す)。full なら描いた本文を残す
// - throttle のある連絡は経路の send の前に間引きを当てる(sendMessage/throttle.ts)
// required・秘密の連絡はキューに置かれない(送る口が要求の中で送り切る)ので、ここには来ない

import { DomainError } from "@/lib/errors";

import type { MessageDelivery, MessageDispatch } from "../../../entities/model";
import type { MessageDeliveryTarget } from "../../../entities/schema";
import { buildRecipientValues, channelContent, renderValue, toVariableMap } from "../sendMessage/context";
import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import { definitionOfDispatch } from "../sendMessage/dispatchDefinition";
import { sendDeliveries, type DeliveryJob } from "../sendMessage/deliver";
import { activeChannel } from "../sendMessage/expand";
import { recordPolicyOf, type RecordPolicy } from "../sendMessage/record";
import { stopContextOf } from "../sendMessage/sender";
import { checkStops, honoursPreferences } from "../sendMessage/stops";
import { applyThrottle, type ThrottleJob } from "../sendMessage/throttle";
import { deliveryEvents } from "../events/internalEvents";
import type { MessageSweepDeps } from "./types";

export type SendStepResult = { processed: number; sent: number; failed: number; queued: number; other: number };

function addressesOf(row: MessageDelivery): string[] {
  const targets = row.targets as MessageDeliveryTarget[] | null;
  if (targets && targets.length > 0) return targets.map((target) => target.address);
  return row.address ? [row.address] : [];
}

async function loadDefinition(
  deps: MessageSweepDeps,
  dispatch: MessageDispatch,
): Promise<{ resolved: AnyResolvedMessageDefinition; policy: RecordPolicy } | { error: string }> {
  try {
    // テンプレートの回は固定した版から(値の再検査で合わなければ送らずに止める)、それ以外は生成の一覧の定義から
    const loaded = await definitionOfDispatch(deps, dispatch);
    if ("error" in loaded) return loaded;
    const { resolved } = loaded;
    // 本文の残し方は送った時の回に固定した値(後の上書きで変えない)
    const policy = recordPolicyOf({ ...resolved, record: dispatch.record ?? resolved.record });
    return { resolved, policy };
  } catch (error) {
    if (error instanceof DomainError) return { error: "definition_invalid" };
    throw error;
  }
}

/** 取った行の束を送り、結果を lock_token つきで書く */
export async function sendClaimed(
  deps: MessageSweepDeps,
  rows: readonly MessageDelivery[],
  lockToken: string,
): Promise<SendStepResult> {
  const result: SendStepResult = { processed: rows.length, sent: 0, failed: 0, queued: 0, other: 0 };
  const count = (status: string) => {
    if (status === "sent") result.sent += 1;
    else if (status === "failed") result.failed += 1;
    else if (status === "queued") result.queued += 1;
    else result.other += 1;
  };
  const release = { locked_until: null, lock_token: null };
  const types = deps.eventTypes ?? new Set<string>();
  /** 行の状態が変わった時の内部の事件(購読が聞いている種類だけ、行の更新と同じ取引で書く) */
  const eventsOf = (row: MessageDelivery, status: string, reason: string | null, messageKey: string | null) =>
    deliveryEvents(types, [{ id: row.id, dispatch_id: row.dispatch_id, channel: row.channel, status, reason }], messageKey, deps.now());
  const byDispatch = new Map<string, MessageDelivery[]>();
  for (const row of rows) byDispatch.set(row.dispatch_id, [...(byDispatch.get(row.dispatch_id) ?? []), row]);
  const dispatches = new Map((await deps.sweepStore.findDispatches([...byDispatch.keys()])).map((d) => [d.id, d]));

  for (const [dispatchId, group] of byDispatch) {
    const dispatch = dispatches.get(dispatchId);
    const loaded = dispatch ? await loadDefinition(deps, dispatch) : { error: "dispatch_missing" };
    if ("error" in loaded) {
      for (const row of group) {
        await deps.sweepStore.updateClaimed(
          row.id,
          lockToken,
          {
            ...release,
            status: "failed",
            last_error: loaded.error,
            next_attempt_at: null,
            failed_at: deps.now(),
            updatedAt: deps.now(),
          },
          eventsOf(row, "failed", loaded.error, dispatch?.message_key ?? null),
        );
        count("failed");
      }
      continue;
    }
    const { resolved, policy } = loaded;
    const messageKey = dispatch!.message_key ?? null;
    /** 前の実行で宛先の 1 つにもう送れた行(delivery.sent は書いた後) */
    const sentBefore = (row: MessageDelivery) =>
      ((row.targets as MessageDeliveryTarget[] | null) ?? []).some((target) => target.status === "sent");
    const rowsById = new Map(group.map((row) => [row.id, row]));
    const vars = (dispatch!.vars ?? {}) as Record<string, unknown>;
    const userIds = [...new Set(group.flatMap((row) => (row.user_id ? [row.user_id] : [])))];
    const users = new Map((await deps.store.findUsers(userIds)).map((user) => [user.id, user]));

    // 送る直前に配信停止を確かめ直す(キューに置いた後で止めた人を外す)。送り直し待ちの宛先だけを見る
    const stops = stopContextOf(resolved);
    const pendingOf = (row: MessageDelivery) => {
      const targets = row.targets as MessageDeliveryTarget[] | null;
      return targets && targets.length > 0
        ? targets.filter((target) => target.status === "queued").map((target) => target.address)
        : addressesOf(row);
    };
    const checkable = group.filter((row) => activeChannel(deps.channels, row.channel) && addressesOf(row).length > 0);
    const verdicts = new Map(
      (
        await checkStops(
          deps,
          stops,
          checkable.map((row) => ({
            recipientKey: row.recipient_key,
            userId: row.user_id,
            channel: row.channel,
            addresses: pendingOf(row),
          })),
        )
      ).map((verdict, index) => [checkable[index].id, verdict]),
    );

    const prepared: ThrottleJob[] = [];
    const bodies = new Map<string, Record<string, unknown>>();
    for (const row of group) {
      const channel = activeChannel(deps.channels, row.channel);
      let addresses = addressesOf(row);
      const verdict = verdicts.get(row.id);
      if (verdict?.stopped) {
        const alreadySent = sentBefore(row);
        await deps.sweepStore.updateClaimed(
          row.id,
          lockToken,
          {
            ...release,
            // 宛先の 1 つにもう送れた行は sent のまま、残りの送り直しをやめる
            ...(alreadySent ? { status: "sent" as const } : { status: "suppressed" as const, reason: verdict.reason }),
            next_attempt_at: null,
            updatedAt: deps.now(),
          },
          alreadySent ? [] : eventsOf(row, "suppressed", verdict.reason, messageKey),
        );
        count(alreadySent ? "sent" : "suppressed");
        continue;
      }
      if (verdict && !verdict.stopped) {
        // 止めた宛先を外す(送れた・失敗が決まった宛先は残す)
        const pending = new Set(pendingOf(row));
        addresses = addresses.filter((address) => !pending.has(address) || verdict.addresses.includes(address));
      }
      if (!channel || addresses.length === 0) {
        const reason = channel ? "no_address" : "channel_off";
        await deps.sweepStore.updateClaimed(
          row.id,
          lockToken,
          { ...release, status: "suppressed", reason, next_attempt_at: null, updatedAt: deps.now() },
          eventsOf(row, "suppressed", reason, messageKey),
        );
        count("suppressed");
        continue;
      }
      const values = await buildRecipientValues({
        deps,
        resolved,
        vars,
        recipientVars: (row.vars ?? undefined) as Record<string, unknown> | undefined,
        user: row.user_id ? (users.get(row.user_id) ?? null) : null,
      });
      const content = renderValue(channelContent(resolved, row.channel, channel), toVariableMap(values)) as Record<
        string,
        unknown
      >;
      bodies.set(row.id, content);
      prepared.push({
        values,
        job: {
          deliveryId: row.id,
          recipientKey: row.recipient_key,
          channel: row.channel,
          userId: row.user_id,
          addresses,
          attempts: row.attempts,
          content,
          targets: row.targets as MessageDeliveryTarget[] | null,
        },
      });
    }

    // 会話の間引き(鍵の lock の中で受信者の行を読み直して決める。決めた行は間引きが lease ごと書いたので数えるだけ)
    const throttled = await applyThrottle(deps, {
      dispatchId: dispatch!.id,
      audienceType: (dispatch!.audience as { type?: string } | null)?.type ?? null,
      resolved,
      vars,
      policy,
      jobs: prepared,
    });
    for (const decided of throttled.decided) {
      if (rowsById.has(decided.deliveryId)) count(decided.status);
    }
    const jobs: DeliveryJob[] = throttled.jobs;

    const results = await sendDeliveries(deps, {
      messageKey: resolved.key,
      jobs,
      policy,
      inRequestOnly: false,
      category: honoursPreferences(stops) ? (stops.category ?? undefined) : undefined,
    });
    for (const sent of results) {
      const patch = { ...sent.patch };
      if (policy.keepRecipientBody) patch.body = bodies.get(sent.deliveryId) ?? null;
      if (sent.status !== "queued" && !policy.keepVars) patch.vars = null;
      const row = rowsById.get(sent.deliveryId)!;
      // 宛先が複数で前の実行で sent になった行は、もう一度 delivery.sent を書かない
      const events = sent.status === "sent" && sentBefore(row) ? [] : eventsOf(row, sent.status, null, messageKey);
      await deps.sweepStore.updateClaimed(sent.deliveryId, lockToken, patch, events);
      count(sent.status);
    }
  }
  return result;
}
