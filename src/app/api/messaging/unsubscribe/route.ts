// src/app/api/messaging/unsubscribe/route.ts
//
// ワンクリックの配信停止の受け口(D35、RFC 8058)。ログイン不要で、署名つきトークン ?token= が権限(HMAC)。
// 機能の門は持たない(常に開: 好みの画面を閉じても 404 にしない、D57・D90)。書き込みは messaging の service。
// - POST だけ: メールソフトのワンクリック(List-Unsubscribe のヘッダの URL へ、本文 List-Unsubscribe=One-Click。本文は無くても受ける)と、
//   確認のページ /unsubscribe の「配信を停止する」ボタン(client service)。停止を 1 回で記録して JSON を返す。HTML は返さない
// - GET は無い(人が開く住所は確認のページ /unsubscribe?token=… の 1 つ。古い ?t= のリンクを移す口は作らない、D42)

import { NextResponse } from "next/server";

import {
  UNSUBSCRIBE_TOKEN_PARAM,
  recordUnsubscribe,
  verifyUnsubscribeToken,
} from "@/features/core/messaging/services/server/unsubscribe";
import { createApiRoute } from "@/wiring/apiRoute";

export const POST = createApiRoute(
  {
    operation: "POST /api/messaging/unsubscribe",
    operationType: "write",
    access: "public",
    skipForDemo: false,
  },
  async (req) => {
    const payload = verifyUnsubscribeToken(new URL(req.url).searchParams.get(UNSUBSCRIBE_TOKEN_PARAM));
    if (!payload) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
    }
    await recordUnsubscribe(payload);
    return NextResponse.json({ ok: true });
  },
);
