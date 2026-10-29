// src/app/api/wallet/purchase/callback/route.ts
// Fincodeからの POST リダイレクトを受け取り、GET でページにリダイレクト
//
// 認可: 決済サービスから利用者のブラウザが戻ってくる入口なので access "public"（ログイン Cookie が
// 付かない遷移もある）。デモ利用者でも戻り先へ送るため skipForDemo false。
// 真正性はここで確かめない（クエリの request_id / reason を戻り先ページへ写すだけで、何も確定しない）。
// 支払いの確定は次の 2 つが守る:
// - GET /api/wallet/purchase/[id]/status（本人照合 + provider への照会。戻り先ページがポーリングする）
// - POST /api/webhook/payment（provider の署名検証）

import { NextRequest, NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";

/**
 * リダイレクト処理の共通ロジック
 */
function handleRedirect(request: NextRequest): NextResponse {
  const searchParams = request.nextUrl.searchParams;
  const requestId = searchParams.get("request_id");
  const walletType = searchParams.get("wallet_type") || "coin";
  const reason = searchParams.get("reason");

  // キャンセル or 失敗の場合は failed ページへ
  const targetPath = reason
    ? `/wallet/${walletType}/purchase/failed`
    : `/wallet/${walletType}/purchase/callback`;

  const redirectUrl = new URL(targetPath, request.url);

  if (requestId) {
    redirectUrl.searchParams.set("request_id", requestId);
  }
  if (reason) {
    redirectUrl.searchParams.set("reason", reason);
  }

  // GETリダイレクト（303 See Other）
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

/**
 * Fincode決済完了後のPOSTリダイレクトを処理
 * POSTで受け取った情報をクエリパラメータに変換してGETリダイレクト
 */
export const POST = createApiRoute(
  {
    operation: "POST /api/wallet/purchase/callback",
    operationType: "read",
    access: "public",
    skipForDemo: false,
  },
  async (request) => handleRedirect(request),
);

/**
 * GETリクエストも同様にリダイレクト（フォールバック）
 */
export const GET = createApiRoute(
  {
    operation: "GET /api/wallet/purchase/callback",
    operationType: "read",
    access: "public",
    skipForDemo: false,
  },
  async (request) => handleRedirect(request),
);
