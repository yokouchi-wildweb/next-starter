// src/features/core/messaging/services/server/unsubscribe/recordOneClick.ts
//
// ワンクリックの配信停止を 1 回で記録する(何度届いても同じ結果)。
// - user:<id> → message_preferences {user_id, category, channel, source "one_click"}(既にあれば何もしない。利用者が消えていれば何もしない)
// - addr:<hash> → message_suppressions {channel, address_hash, reason one_click, scope = category, source "one_click"}

import type { UnsubscribeTokenPayload } from "./token";

export type OneClickStore = {
  /** 好みの行を足す(既にあれば何もしない)。利用者がいなければ false */
  addPreference: (values: { userId: string; category: string; channel: string; source: string }) => Promise<boolean>;
  addSuppression: (values: { channel: string; addressHash: string; scope: string; source: string }) => Promise<void>;
};

export type OneClickResult = { recorded: "preference" | "suppression" | "none" };

export const ONE_CLICK_SOURCE = "one_click";

export async function recordOneClickUnsubscribe(
  store: OneClickStore,
  payload: UnsubscribeTokenPayload,
): Promise<OneClickResult> {
  const [kind, id] = payload.recipientKey.split(":");
  if (kind === "user") {
    const added = await store.addPreference({
      userId: id,
      category: payload.category,
      channel: payload.channel,
      source: ONE_CLICK_SOURCE,
    });
    return { recorded: added ? "preference" : "none" };
  }
  await store.addSuppression({
    channel: payload.channel,
    addressHash: payload.addressHash ?? id,
    scope: payload.category,
    source: ONE_CLICK_SOURCE,
  });
  return { recorded: "suppression" };
}
