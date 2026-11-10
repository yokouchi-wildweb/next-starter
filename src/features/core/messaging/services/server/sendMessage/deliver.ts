// src/features/core/messaging/services/server/sendMessage/deliver.ts
//
// 配達の行を経路の受け口の項目の send(targets) で送り、結果を行の状態に写す(D34・D45)。
// - 宛先ごとの冪等の鍵 = 配達の行の id(宛先が複数なら <id>:<番号>)
// - sent → sent / permanent → failed / unknown(と send が投げた例外)→ unknown(自動で送り直さない)
// - transient: inRequestOnly(required・秘密)は要求の中で短く再送し、尽きたら failed。
//   それ以外は queued のまま next_attempt_at を広げて cron に任せ、回数が尽きたら failed
// - 行の状態は宛先の 1 つでも sent なら sent

import { ChannelError, type ChannelSendResult, type ChannelSendTarget } from "@/lib/messaging";

import type { MessageDeliveryInsert, MessageDeliveryStatus } from "../../../entities/model";
import type { MessageDeliveryTarget } from "../../../entities/schema";
import { activeChannel } from "./expand";
import { errorText, type RecordPolicy } from "./record";
import type { MessageSendDeps } from "./types";

/** 送る配達の行 1 つ(content = その受信者へ描いた中身) */
export type DeliveryJob = {
  deliveryId: string;
  channel: string;
  userId: string | null;
  addresses: string[];
  /** これまでの試行の回数 */
  attempts: number;
  content: Record<string, unknown>;
  /** 前の試行の宛先ごとの状態(cron の送り直し)。queued の宛先だけを送る(D45) */
  targets?: readonly MessageDeliveryTarget[] | null;
};

/** 送った後の行の状態 */
export type DeliveryResult = {
  deliveryId: string;
  channel: string;
  status: MessageDeliveryStatus;
  patch: Partial<MessageDeliveryInsert>;
};

type AddressState = MessageDeliveryTarget;

function targetKey(job: DeliveryJob, index: number): string {
  return job.addresses.length > 1 ? `${job.deliveryId}:${index}` : job.deliveryId;
}

/** 経路の send を 1 回呼ぶ。投げたら束の全部をその分類(ChannelError 以外は unknown)にする */
async function callSend(
  deps: MessageSendDeps,
  channelKey: string,
  targets: ChannelSendTarget[],
): Promise<ChannelSendResult[]> {
  const channel = activeChannel(deps.channels, channelKey);
  if (!channel || targets.length === 0) return [];
  try {
    return await channel.send(targets);
  } catch (error) {
    const kind = error instanceof ChannelError ? error.kind : "unknown";
    const reason = error instanceof ChannelError ? error.reason : "send_threw";
    const message = error instanceof Error ? error.message : String(error);
    return targets.map((target) => ({ address: target.address, kind, reason, message }));
  }
}

/** 行の宛先の状態から行の状態を決める */
function rowStatus(states: readonly AddressState[]): MessageDeliveryStatus | "transient" {
  if (states.some((state) => state.status === "sent")) return "sent";
  if (states.some((state) => state.status === "unknown")) return "unknown";
  if (states.some((state) => state.status === "queued")) return "transient";
  return "failed";
}

/**
 * 配達の行の束を送る(経路ごとに 1 回の send、transient は inRequestOnly なら短く再送)。
 */
export async function sendDeliveries(
  deps: MessageSendDeps,
  params: { jobs: readonly DeliveryJob[]; policy: RecordPolicy; inRequestOnly: boolean },
): Promise<DeliveryResult[]> {
  const { jobs, policy, inRequestOnly } = params;
  const now = deps.now;
  const states = new Map<string, AddressState[]>();
  const errors = new Map<string, string>();
  const providers = new Map<string, { provider: string | null; providerMessageId: string | null }>();
  const attempts = new Map<string, number>();

  for (const job of jobs) {
    const previous = new Map((job.targets ?? []).map((target) => [target.address, target]));
    states.set(
      job.deliveryId,
      job.addresses.map((address) => {
        const before = previous.get(address);
        return before
          ? { ...before }
          : {
              address,
              status: "queued" as const,
              attempts: job.attempts,
              next_attempt_at: null,
              provider_message_id: null,
              last_error: null,
            };
      }),
    );
    attempts.set(job.deliveryId, job.attempts);
  }

  const retry = deps.config.requiredRetry;
  const maxRounds = inRequestOnly ? Math.max(1, retry.attempts) : 1;
  for (let round = 0; round < maxRounds; round += 1) {
    if (round > 0) await deps.sleep(retry.delaysMs[Math.min(round - 1, retry.delaysMs.length - 1)] ?? 0);
    const pending = jobs.filter((job) => states.get(job.deliveryId)!.some((state) => state.status === "queued"));
    if (pending.length === 0) break;

    const byChannel = new Map<string, { target: ChannelSendTarget; job: DeliveryJob; index: number }[]>();
    for (const job of pending) {
      attempts.set(job.deliveryId, (attempts.get(job.deliveryId) ?? 0) + 1);
      states.get(job.deliveryId)!.forEach((state, index) => {
        if (state.status !== "queued") return;
        state.attempts += 1;
        const list = byChannel.get(job.channel) ?? [];
        list.push({
          job,
          index,
          target: { userId: job.userId, address: state.address, idempotencyKey: targetKey(job, index), content: job.content },
        });
        byChannel.set(job.channel, list);
      });
    }

    for (const [channelKey, entries] of byChannel) {
      const results = await callSend(deps, channelKey, entries.map((entry) => entry.target));
      entries.forEach((entry, position) => {
        // 結果は宛先で照らす(並びがずれても合う)。返らなかった宛先は unknown
        const result =
          results.find((item) => item.address === entry.target.address) ?? results[position] ?? null;
        const state = states.get(entry.job.deliveryId)![entry.index];
        if (!result) {
          state.status = "unknown";
          state.last_error = "no_result";
          errors.set(entry.job.deliveryId, "no_result");
          return;
        }
        if (result.kind === "sent") {
          state.status = "sent";
          state.provider_message_id = result.providerMessageId ?? null;
          state.last_error = null;
          providers.set(entry.job.deliveryId, {
            provider: result.provider ?? null,
            providerMessageId: result.providerMessageId ?? null,
          });
          return;
        }
        const text = errorText(policy, result.reason, result.message);
        state.last_error = text;
        errors.set(entry.job.deliveryId, text);
        if (result.provider) {
          providers.set(entry.job.deliveryId, { provider: result.provider, providerMessageId: null });
        }
        if (result.kind === "permanent") state.status = "failed";
        else if (result.kind === "unknown") state.status = "unknown";
        // transient は queued のまま(次の周回か cron)
      });
    }
  }

  const { maxAttempts, baseDelaySeconds, factor } = deps.config.transientRetry;
  return jobs.map((job) => {
    const list = states.get(job.deliveryId)!;
    const count = attempts.get(job.deliveryId) ?? job.attempts;
    let status = rowStatus(list);
    let nextAttemptAt: Date | null = null;
    // 一時の失敗の宛先が残る(行が sent でも、送れた宛先とは別に送り直す: D45)
    if (list.some((state) => state.status === "queued")) {
      if (inRequestOnly || count >= maxAttempts) {
        if (status === "transient") status = "failed";
        for (const state of list) if (state.status === "queued") state.status = "failed";
      } else {
        nextAttemptAt = new Date(now().getTime() + baseDelaySeconds * factor ** (count - 1) * 1000);
        for (const state of list) if (state.status === "queued") state.next_attempt_at = nextAttemptAt.toISOString();
      }
    }
    const finalStatus: MessageDeliveryStatus = status === "transient" ? "queued" : status;
    const provider = providers.get(job.deliveryId);
    const at = now();
    const patch: Partial<MessageDeliveryInsert> = {
      status: finalStatus,
      attempts: count,
      next_attempt_at: nextAttemptAt,
      last_error: finalStatus === "sent" ? null : (errors.get(job.deliveryId) ?? null),
      // provider の id はこの試行で得た時だけ書く(送り直しで前の値を消さない)
      ...(provider ? { provider: provider.provider, provider_message_id: provider.providerMessageId } : {}),
      targets: list.length > 1 ? list : null,
      // lease を外す(cron が取った行)
      locked_until: null,
      lock_token: null,
      updatedAt: at,
    };
    if (finalStatus === "sent") patch.sent_at = at;
    if (finalStatus === "failed") patch.failed_at = at;
    return { deliveryId: job.deliveryId, channel: job.channel, status: finalStatus, patch };
  });
}
