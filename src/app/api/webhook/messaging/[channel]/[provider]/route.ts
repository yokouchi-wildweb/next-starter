// src/app/api/webhook/messaging/[channel]/[provider]/route.ts
//
// 連絡の経路の provider の webhook の受け口(D44: 1 本の住所)。例 /api/webhook/messaging/email/resend
// 生の本文で経路の項目の webhooks[provider].verify → normalize → messaging の service が記録に当てる。
// - 知らない経路・provider は 404、鍵(env)が無い時は 503、署名の誤りは 401
// - 当てる処理の誤りは 500(provider が送り直す。事件は一度だけ入るので重ならない)
// 機能の門は持たない(配達・bounce・苦情のために常に開。開封・クリックだけ計測の機能 messagingTracking が閉じる)

import { NextResponse } from "next/server";

import { handleChannelWebhook } from "@/features/core/messaging/services/server/webhooks";
import { createApiRoute } from "@/wiring/apiRoute";

export const POST = createApiRoute<{ channel: string; provider: string }, unknown, "public">(
  {
    operation: "POST /api/webhook/messaging/[channel]/[provider]",
    operationType: "write",
    access: "public",
    skipForDemo: false,
  },
  async (req, { params }) => {
    const rawBody = await req.clone().text();
    const result = await handleChannelWebhook({
      channel: params.channel,
      provider: params.provider,
      rawBody,
      headers: req.headers,
    });
    return NextResponse.json(result.body, { status: result.status });
  },
);
