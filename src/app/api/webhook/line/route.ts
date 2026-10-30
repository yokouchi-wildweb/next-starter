// src/app/api/webhook/line/route.ts

import { NextResponse } from "next/server";

import { webhookHandlers } from "@/features/core/userLineProfile/extensions/webhookHandlers";
import { dispatchWebhookEvents } from "@/features/core/userLineProfile/services/server/dispatchWebhookEvents";
import { createApiRoute } from "@/wiring/apiRoute";
import { parseWebhookRequest } from "@/lib/line/webhook";

/**
 * LINE Webhook 受信エンドポイント。
 * x-line-signature ヘッダーで署名検証を行い、イベントを userLineProfile の webhookHandlers へ渡す。
 *
 * LINE Platform は 200 を返さないと再送を繰り返すため、
 * イベント処理でエラーが発生しても 200 を返す。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/webhook/line",
    operationType: "write",
    access: "public",
    skipForDemo: false,
  },
  async (req) => {
    let events;
    try {
      ({ events } = await parseWebhookRequest(req.clone()));
    } catch (err) {
      // 署名検証失敗
      console.error("[LINE Webhook] 署名検証エラー:", err);
      return NextResponse.json(
        { success: false, error: "invalid_signature" },
        { status: 401 },
      );
    }

    await dispatchWebhookEvents(events, webhookHandlers);
    return NextResponse.json({ success: true });
  },
);
