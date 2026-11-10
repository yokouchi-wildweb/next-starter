// src/app/api/messaging/unsubscribe/route.ts
//
// ワンクリックの配信停止の受け口(D35、RFC 8058)。ログイン不要で、署名つきトークン ?t= が権限(HMAC)。
// 機能の門は持たない(常に開: 好みの画面を閉じても 404 にしない、D57)。書き込みは messaging の service。
// - POST: メールソフトのワンクリック(本文 List-Unsubscribe=One-Click。本文は無くても受ける)。停止を 1 回で記録して 200
// - GET: 状態を変えない。本文のリンクから開いた人へ、同じ URL へ POST するボタン 1 つの確認のページ(script なし)
//   (好みの画面ができたら本文のリンクの行き先はそちらへ移る)

import { NextResponse } from "next/server";

import {
  recordUnsubscribe,
  verifyUnsubscribeToken,
} from "@/features/core/messaging/services/server/unsubscribe";
import { createApiRoute } from "@/wiring/apiRoute";

const tokenOf = (req: Request) => new URL(req.url).searchParams.get("t");

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>配信停止</title></head><body style="font-family:sans-serif;max-width:480px;margin:48px auto;padding:0 16px;line-height:1.7">${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export const POST = createApiRoute(
  {
    operation: "POST /api/messaging/unsubscribe",
    operationType: "write",
    access: "public",
    skipForDemo: false,
  },
  async (req) => {
    const payload = verifyUnsubscribeToken(tokenOf(req));
    if (!payload) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
    }
    await recordUnsubscribe(payload);
    // フォームから来た人(確認のページのボタン)には完了のページを返す
    if ((req.headers.get("accept") ?? "").includes("text/html")) {
      return html("<h1>配信を停止しました</h1><p>この種類のお知らせは今後届きません。</p>");
    }
    return NextResponse.json({ ok: true });
  },
);

export const GET = createApiRoute(
  {
    operation: "GET /api/messaging/unsubscribe",
    operationType: "read",
    access: "public",
  },
  async (req) => {
    const token = tokenOf(req);
    if (!verifyUnsubscribeToken(token)) {
      return html("<h1>リンクが正しくありません</h1><p>メールのリンクをもう一度お確かめください。</p>", 400);
    }
    const action = `?t=${encodeURIComponent(token!)}`;
    return html(
      `<h1>配信停止</h1><p>この種類のお知らせの配信を停止します。</p><form method="post" action="${escapeAttr(action)}"><button type="submit" style="padding:8px 20px">配信を停止する</button></form>`,
    );
  },
);
