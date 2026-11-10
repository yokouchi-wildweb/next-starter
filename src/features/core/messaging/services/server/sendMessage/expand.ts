// src/features/core/messaging/services/server/sendMessage/expand.ts
//
// 宛先の展開: 受信者 × 経路 → 配達の行の計画(宛先の解決は経路の resolveAddresses、無ければ端末の帳簿)。
// - 選んだ宛先(explicit): 宛先の無い受信者も suppressed + reason no_address の行にして呼び手へ返す(D46)
// - 全員・ロール・audiences(broadcast): 宛先の無い利用者は行を作らず、経路ごとの数 skipped_no_address に数える(D46)
//   束ごとの展開(expandBroadcastChunk / resolveAudienceChunk)は cron(次の指令)が呼ぶ
// - 経路の項目が無い・enabled: false の経路は channel_off(explicit は行、broadcast は suppressed に数える)

import { createHash } from "node:crypto";

import type { MessageAudienceCursor, MessageChannel } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import type { MessageDeliveryInsert, MessageDeliveryReason } from "../../../entities/model";
import type { MessageAudienceSpec, MessageRecipient, MessageSendDeps, MessageUserRow } from "./types";

/** 配達の行の計画 1 つ */
export type PlannedDelivery = {
  recipientKey: string;
  userId: string | null;
  channel: string;
  addresses: string[];
  status: "queued" | "suppressed";
  reason: MessageDeliveryReason | null;
};

/** 経路ごとの数の素(送る前) */
export type ExpansionCounts = Record<string, { targeted: number; skippedNoAddress: number; suppressed: number }>;

/** 送れる経路の項目(無い・enabled: false は undefined = channel_off) */
export function activeChannel(
  channels: Readonly<Record<string, MessageChannel>>,
  key: string,
): MessageChannel | undefined {
  const channel = channels[key];
  return channel && channel.enabled !== false ? channel : undefined;
}

export function userRecipientKey(userId: string): string {
  return `user:${userId}`;
}

export function addressRecipientKey(address: string): string {
  return `addr:${createHash("sha256").update(address.trim().toLowerCase()).digest("hex")}`;
}

export function recipientKeyOf(recipient: MessageRecipient): string {
  return "userId" in recipient ? userRecipientKey(recipient.userId) : addressRecipientKey(recipient.address);
}

/** 利用者 → 経路の宛先の一覧 */
async function resolveUserAddresses(
  deps: MessageSendDeps,
  channelKey: string,
  channel: MessageChannel,
  userIds: readonly string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  const found = channel.resolveAddresses
    ? await channel.resolveAddresses(userIds)
    : await deps.store.findActiveEndpoints(channelKey, userIds);
  for (const entry of found) {
    if (!entry.userId || !entry.address) continue;
    const list = map.get(entry.userId) ?? [];
    if (!list.includes(entry.address)) list.push(entry.address);
    map.set(entry.userId, list);
  }
  return map;
}

function emptyCounts(channels: readonly string[]): ExpansionCounts {
  return Object.fromEntries(channels.map((key) => [key, { targeted: 0, skippedNoAddress: 0, suppressed: 0 }]));
}

/**
 * 選んだ宛先の展開(小さな送信、要求の中)。
 * - 宛先を直に渡す受信者は、その経路が送る経路に入っていること
 * @returns 計画・利用者・見つからなかった利用者 id
 */
export async function expandExplicit(
  deps: MessageSendDeps,
  params: { channels: readonly string[]; recipients: readonly MessageRecipient[] },
): Promise<{ planned: PlannedDelivery[]; users: Map<string, MessageUserRow>; unknownUserIds: string[]; counts: ExpansionCounts }> {
  const { channels } = params;
  const seen = new Set<string>();
  const recipients = params.recipients.filter((recipient) => {
    const key = recipientKeyOf(recipient);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const userIds = recipients.flatMap((recipient) => ("userId" in recipient ? [recipient.userId] : []));
  const userRows = await deps.store.findUsers(userIds);
  const users = new Map(userRows.map((user) => [user.id, user]));
  const unknownUserIds = userIds.filter((id) => !users.has(id));
  const knownUserIds = userIds.filter((id) => users.has(id));

  for (const recipient of recipients) {
    if (!("userId" in recipient) && !channels.includes(recipient.channel)) {
      throw new DomainError(`宛先の経路 ${recipient.channel} が送る経路にありません`, { status: 400 });
    }
  }

  const planned: PlannedDelivery[] = [];
  const counts = emptyCounts(channels);
  for (const channelKey of channels) {
    const channel = activeChannel(deps.channels, channelKey);
    const addresses = channel ? await resolveUserAddresses(deps, channelKey, channel, knownUserIds) : new Map<string, string[]>();
    for (const recipient of recipients) {
      let userId: string | null = null;
      let list: string[];
      if ("userId" in recipient) {
        if (!users.has(recipient.userId)) continue;
        userId = recipient.userId;
        list = addresses.get(recipient.userId) ?? [];
      } else {
        if (recipient.channel !== channelKey) continue;
        list = [recipient.address];
      }
      counts[channelKey].targeted += 1;
      const base = { recipientKey: recipientKeyOf(recipient), userId, channel: channelKey };
      if (!channel) {
        counts[channelKey].suppressed += 1;
        planned.push({ ...base, addresses: list, status: "suppressed", reason: "channel_off" });
      } else if (list.length === 0) {
        counts[channelKey].skippedNoAddress += 1;
        planned.push({ ...base, addresses: [], status: "suppressed", reason: "no_address" });
      } else {
        planned.push({ ...base, addresses: list, status: "queued", reason: null });
      }
    }
  }
  return { planned, users, unknownUserIds, counts };
}

/**
 * 全員・ロール・audiences の 1 束の展開(cron が呼ぶ)。宛先の無い利用者は行を作らず skipped_no_address に数える。
 */
export async function expandBroadcastChunk(
  deps: MessageSendDeps,
  params: { channels: readonly string[]; userIds: readonly string[] },
): Promise<{ planned: PlannedDelivery[]; counts: ExpansionCounts }> {
  const userIds = [...new Set(params.userIds)];
  const planned: PlannedDelivery[] = [];
  const counts = emptyCounts(params.channels);
  for (const channelKey of params.channels) {
    const channel = activeChannel(deps.channels, channelKey);
    counts[channelKey].targeted += userIds.length;
    if (!channel) {
      counts[channelKey].suppressed += userIds.length;
      continue;
    }
    const addresses = await resolveUserAddresses(deps, channelKey, channel, userIds);
    for (const userId of userIds) {
      const list = addresses.get(userId) ?? [];
      if (list.length === 0) {
        counts[channelKey].skippedNoAddress += 1;
        continue;
      }
      planned.push({
        recipientKey: userRecipientKey(userId),
        userId,
        channel: channelKey,
        addresses: list,
        status: "queued",
        reason: null,
      });
    }
  }
  return { planned, counts };
}

/**
 * audience の次の束の利用者 id(keyset)。束の人数は config.expandChunkSize。
 * @throws DomainError(400) audiences の項目が無い・引数が合わない
 */
export async function resolveAudienceChunk(
  deps: MessageSendDeps,
  spec: MessageAudienceSpec,
  cursor: MessageAudienceCursor,
): Promise<{ userIds: string[]; nextCursor: MessageAudienceCursor }> {
  const limit = deps.config.expandChunkSize;
  if (spec.type === "all") return deps.store.listUserIds({}, cursor, limit);
  if (spec.type === "role") return deps.store.listUserIds({ roles: spec.roles }, cursor, limit);
  const audience = deps.audiences[spec.key];
  if (!audience) throw new DomainError(`宛先の集め方 ${spec.key} がありません`, { status: 400 });
  const args = audience.args.safeParse(spec.args);
  if (!args.success) throw new DomainError(`宛先の集め方 ${spec.key} の引数が合いません`, { status: 400 });
  return audience.resolveUserIds(args.data, cursor);
}

/**
 * 計画 → 配達の行の INSERT の値。queued の行は next_attempt_at = now(cron がすぐ拾う)。
 * 宛先が複数なら targets に宛先ごとの状態を置く
 */
export function toDeliveryInsert(
  plan: PlannedDelivery,
  params: { dispatchId: string; now: Date; vars: Record<string, unknown> | null },
): MessageDeliveryInsert {
  const queued = plan.status === "queued";
  return {
    dispatch_id: params.dispatchId,
    recipient_key: plan.recipientKey,
    user_id: plan.userId,
    address: plan.addresses[0] ?? null,
    channel: plan.channel,
    status: plan.status,
    reason: plan.reason,
    vars: queued ? params.vars : null,
    next_attempt_at: queued ? params.now : null,
    targets:
      plan.addresses.length > 1
        ? plan.addresses.map((address) => ({
            address,
            status: "queued" as const,
            attempts: 0,
            next_attempt_at: null,
            provider_message_id: null,
            last_error: null,
          }))
        : null,
  };
}
