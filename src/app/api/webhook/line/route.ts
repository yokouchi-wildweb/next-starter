// src/app/api/webhook/line/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { parseWebhookRequest } from "@/lib/line/webhook";
import type { LineWebhookEvent } from "@/lib/line/types";

/**
 * LINE Webhook のイベントハンドラ型。
 * ダウンストリームでオーバーライドするための拡張ポイント。
 */
export type LineWebhookHandler = (event: LineWebhookEvent) => Promise<void>;

/**
 * デフォルトのイベントハンドラ（何もしない）。
 * ダウンストリームで上書きする場合はこのファイルを差し替える。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleEvent: LineWebhookHandler = async (_event) => {
  // ダウンストリームでイベント処理を実装する
  // 例:
  // switch (event.type) {
  //   case "follow":
  //     await handleFollowEvent(event);
  //     break;
  //   case "message":
  //     await handleMessageEvent(event);
  //     break;
  // }
};

/**
 * LINE Webhook 受信エンドポイント。
 * x-line-signature ヘッダーで署名検証を行い、イベントを処理する。
 *
 * LINE Platform は 200 を返さないと再送を繰り返すため、
 * イベント処理でエラーが発生しても 200 を返す。
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/webhook/line",
    operationType: "write",
    skipForDemo: false,
  },
  async (req) => {
    try {
      const webhookBody = await parseWebhookRequest(req.clone());

      // 各イベントを順次処理
      for (const event of webhookBody.events) {
        try {
          await handleEvent(event);
        } catch (err) {
          // 個別イベントの処理失敗はログに記録して続行
          console.error("[LINE Webhook] イベント処理エラー:", event.type, err);
        }
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      // 署名検証失敗
      console.error("[LINE Webhook] 署名検証エラー:", err);
      return NextResponse.json(
        { success: false, error: "invalid_signature" },
        { status: 401 },
      );
    }
  },
);
