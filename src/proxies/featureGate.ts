// src/proxies/featureGate.ts

import { NextResponse, type NextRequest } from "next/server";

import { gate } from "@/featureGate";

import type { ProxyHandler } from "./types";

// 判定は門番(src/featureGate、gate.path)。規則は 1 機能 1 ファイルの src/featureGate/rules/<名前>.ts。
// ここは gate.path を呼んで応答を作るだけ(同じ住所に当たる閉じた規則が複数あれば、一覧の順で最初の規則の redirectTo)。

/**
 * ブロック時のレスポンスを生成する。
 * - redirectTo が指定されていれば常にそこへ rewrite（従来挙動を維持）
 * - 未指定の API ルート（/api/）は純粋な 404 ステータスを返す
 * - それ以外（ページ）は /404 へ rewrite
 */
function blockResponse(request: NextRequest, redirectTo?: string): NextResponse {
  if (redirectTo) {
    return NextResponse.rewrite(new URL(redirectTo, request.url));
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.rewrite(new URL("/404", request.url));
}

/**
 * 機能フラグに基づいてルートをブロックするProxy
 * 無効な機能のパスにアクセスした場合は404を返す
 */
export const featureGateProxy: ProxyHandler = (request) => {
  const result = gate.path(request.nextUrl.pathname);
  if (result.closed) return blockResponse(request, result.redirectTo);
};
