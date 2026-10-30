// src/features/core/userLineProfile/types/webhook.ts

import type { LineWebhookEvent } from "@/lib/line/types";

/** LINE Webhook のイベント処理の項目。eventType が一致するイベントごとに、一覧の順(ファイル名の順)に呼ばれる */
export type LineWebhookEventHandler = {
  /** 処理するイベントの type("follow" / "message" など) */
  eventType: string;
  handle: (event: LineWebhookEvent) => Promise<void>;
};
