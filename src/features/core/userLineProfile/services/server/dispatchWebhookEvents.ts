// src/features/core/userLineProfile/services/server/dispatchWebhookEvents.ts

import type { LineWebhookEvent } from "@/lib/line/types";

import type { LineWebhookEventHandler } from "../../types/webhook";

/**
 * イベントを順に、eventType が一致する項目へ渡す。
 * LINE Platform は 200 を返さないと再送を繰り返すため、個別の失敗はログに記録して続行する。
 */
export async function dispatchWebhookEvents(
  events: readonly LineWebhookEvent[],
  handlers: readonly LineWebhookEventHandler[],
): Promise<void> {
  for (const event of events) {
    for (const handler of handlers) {
      if (handler.eventType !== event.type) continue;
      try {
        await handler.handle(event);
      } catch (err) {
        console.error("[LINE Webhook] イベント処理エラー:", event.type, err);
      }
    }
  }
}
