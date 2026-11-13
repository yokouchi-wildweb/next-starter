// src/features/core/messaging/services/server/sendMessage/stops.ts
//
// 配信停止(D35): 好み(message_preferences)と宛先の停止(message_suppressions)で配達の計画を外す。
// 小さな送信の展開・cron の展開・cron が送る直前に呼ぶ。
// - 好み: 種別の性質 userStoppable(activity・marketing)で required でない連絡だけ。利用者 × 種類 × 経路、'*' は全部に当たる
// - 宛先の停止(正規化した宛先の sha256): 種別の性質 addressStop が all の連絡は hard_bounce・complaint・manual にいつも従い、
//   one_click は範囲(scope)が連絡の種類か '*' の時だけ従う。hardBounce の種別(functional・security)と required は hard_bounce だけ
// 種別の値で分けない(lib/messaging の MESSAGE_KIND_TRAITS を引く)
// - 宛先が複数なら止めた宛先だけを外す。残りが無ければ suppressed + reason suppression。好みで外した行は reason preference

import { createHash } from "node:crypto";

import { kindTraits, type MessageKind } from "@/lib/messaging";

import { MESSAGE_ALL } from "../../../entities/schema";
import type { MessageSendDeps } from "./types";

/** 停止の確かめに要る連絡の性質 */
export type StopContext = { kind: MessageKind | null; required: boolean; category: string | null };

/** 停止を確かめる計画(展開の計画と、cron が取った配達の行の両方) */
export type StopTarget = {
  recipientKey: string;
  userId: string | null;
  channel: string;
  addresses: string[];
};

export type StopVerdict =
  | { stopped: false; addresses: string[] }
  | { stopped: true; reason: "preference" | "suppression" };

/** 宛先の正規化(前後の空白を外して小文字)の sha256。addr:<hash> の受信者の鍵と宛先の停止の address_hash に使う */
export function hashAddress(address: string): string {
  return createHash("sha256").update(address.trim().toLowerCase()).digest("hex");
}

/** 好みに従う連絡か(= 受信者が止められる連絡。メールは List-Unsubscribe を付ける) */
export function honoursPreferences(context: StopContext): boolean {
  return Boolean(kindTraits(context.kind)?.userStoppable) && !context.required && Boolean(context.category);
}

/** その連絡が従う宛先の停止か */
function suppressionApplies(context: StopContext, row: { reason: string; scope: string }): boolean {
  if (context.required || kindTraits(context.kind)?.addressStop === "hardBounce") return row.reason === "hard_bounce";
  if (row.reason === "one_click") return row.scope === MESSAGE_ALL || row.scope === context.category;
  return true;
}

/**
 * 計画ごとの停止の判定(並びは targets と同じ)。
 */
export async function checkStops(
  deps: MessageSendDeps,
  context: StopContext,
  targets: readonly StopTarget[],
): Promise<StopVerdict[]> {
  if (targets.length === 0) return [];
  const channels = [...new Set(targets.map((target) => target.channel))];

  // 好み
  const optedOut = new Set<string>();
  if (honoursPreferences(context)) {
    const userIds = [...new Set(targets.flatMap((target) => (target.userId ? [target.userId] : [])))];
    for (const row of await deps.store.findOptOuts(userIds, context.category!, channels)) {
      optedOut.add(`${row.userId}|${row.channel}`);
    }
  }

  // 宛先の停止(経路ごとに 1 回引く)
  const suppressed = new Set<string>();
  for (const channel of channels) {
    const hashes = [
      ...new Set(targets.filter((t) => t.channel === channel).flatMap((t) => t.addresses.map(hashAddress))),
    ];
    if (hashes.length === 0) continue;
    for (const row of await deps.store.findSuppressions(channel, hashes)) {
      if (suppressionApplies(context, row)) suppressed.add(`${channel}|${row.addressHash}`);
    }
  }

  return targets.map((target): StopVerdict => {
    if (
      target.userId &&
      (optedOut.has(`${target.userId}|${target.channel}`) || optedOut.has(`${target.userId}|${MESSAGE_ALL}`))
    ) {
      return { stopped: true, reason: "preference" };
    }
    const kept = target.addresses.filter((address) => !suppressed.has(`${target.channel}|${hashAddress(address)}`));
    if (target.addresses.length > 0 && kept.length === 0) return { stopped: true, reason: "suppression" };
    return { stopped: false, addresses: kept };
  });
}
