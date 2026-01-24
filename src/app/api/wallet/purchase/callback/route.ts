// src/app/api/wallet/purchase/callback/route.ts
// Fincodeからの POST リダイレクトを受け取り、GET でページにリダイレクト

import { NextRequest, NextResponse } from "next/server";

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
export async function POST(request: NextRequest) {
  return handleRedirect(request);
}

/**
 * GETリクエストも同様にリダイレクト（フォールバック）
 */
export async function GET(request: NextRequest) {
  return handleRedirect(request);
}
