// src/app/api/webhook/line/route.ts

import { NextResponse } from "next/server";

import { userLineProfileWebhookHandlers } from "@/domains/core/userLineProfile/extensions/userLineProfileWebhookHandlers";
import { gate } from "@/featureGate";
import { dispatchWebhookEvents } from "@/domains/core/userLineProfile/services/server/dispatchWebhookEvents";
import { createApiRoute } from "@/wiring/apiRoute";
import { parseWebhookRequest } from "@/lib/line";

/**
 * LINE Webhook 受信エンドポイント。
 * x-line-signature ヘッダーで署名検証を行い、イベントを userLineProfile の点 userLineProfileWebhookHandlers の項目(閉じたドメインの項目は外す)へ渡す。
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

    await dispatchWebhookEvents(events, gate.plugs(userLineProfileWebhookHandlers).map((entry) => entry.plug));
    return NextResponse.json({ success: true });
  },
);
