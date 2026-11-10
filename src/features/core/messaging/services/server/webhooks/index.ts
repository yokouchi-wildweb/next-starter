// src/features/core/messaging/services/server/webhooks/index.ts
//
// provider の webhook の受け口(/api/webhook/messaging/[channel]/[provider])の本体。route は結果を応答に写すだけ。
// - 知らない経路・provider → 404 / 鍵(env)が無い → 503 / 検証の失敗 → 401
// - 事件の当て方の誤りは投げる(route が 500 にし、provider が送り直す。事件は一度だけ入るので重ならない)

import { gate } from "@/featureGate";

import { channels } from "../../../extensions/channels";
import { applyChannelWebhookEvents, type ApplyEventsResult } from "./applyEvents";
import { WebhookNotConfiguredError } from "./errors";
import { drizzleWebhookStore } from "./store";
import type { MessageChannel } from "@/lib/messaging";

export type ChannelWebhookResponse =
  | { status: 200; body: { ok: true } & ApplyEventsResult }
  | { status: 401 | 404 | 503; body: { ok: false; error: string } };

export type HandleWebhookDeps = {
  channels: Readonly<Record<string, MessageChannel>>;
  apply: (channel: string, events: Parameters<typeof applyChannelWebhookEvents>[2]) => Promise<ApplyEventsResult>;
};

export async function handleChannelWebhookWith(
  deps: HandleWebhookDeps,
  params: { channel: string; provider: string; rawBody: string; headers: Headers },
): Promise<ChannelWebhookResponse> {
  const webhook = deps.channels[params.channel]?.webhooks?.[params.provider];
  if (!webhook) return { status: 404, body: { ok: false, error: "unknown_webhook" } };
  let events;
  try {
    const verified = await webhook.verify({ rawBody: params.rawBody, headers: params.headers });
    events = webhook.normalize(verified);
  } catch (error) {
    if (error instanceof WebhookNotConfiguredError) {
      return { status: 503, body: { ok: false, error: "webhook_not_configured" } };
    }
    return { status: 401, body: { ok: false, error: "invalid_signature" } };
  }
  const result = await deps.apply(params.channel, events);
  return { status: 200, body: { ok: true, ...result } };
}

/** 受け口の本体(本物の部品) */
export function handleChannelWebhook(params: {
  channel: string;
  provider: string;
  rawBody: string;
  headers: Headers;
}): Promise<ChannelWebhookResponse> {
  return handleChannelWebhookWith(
    {
      channels,
      apply: (channel, events) =>
        applyChannelWebhookEvents(
          { store: drizzleWebhookStore, trackingEnabled: () => gate.enabled("messagingTracking"), now: () => new Date() },
          channel,
          events,
        ),
    },
    params,
  );
}

export { WebhookNotConfiguredError } from "./errors";
export { applyChannelWebhookEvents, type ApplyEventsResult, type WebhookStore } from "./applyEvents";
