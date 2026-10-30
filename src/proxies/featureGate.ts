// src/proxies/featureGate.ts

import { NextResponse, type NextRequest } from "next/server";
import { featureGateRules } from "./extensions/featureGateRules";
import { matchesPath } from "./pathPattern.mjs";
import type { ProxyHandler } from "./types";

export { matchesPath };

// ゲートの定義（どの機能がどのパスを持つか）は 1 機能 1 ファイルの src/proxies/featureGateRules/<名前>[.<fork ID>].ts、
// その生成一覧 ./extensions/featureGateRules.ts(ファイル名の順)をここで読む。ここは判定とレスポンス生成だけを持つ。
// 同じ住所に当たる無効な規則が複数あれば、一覧の順で最初の規則の redirectTo(L1.22)。

// パターンの照合(セグメント境界の前方一致 / `=` 付きの完全一致)は ./pathPattern.mjs(ルート地図と検査も同じ物を使う)

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
  const pathname = request.nextUrl.pathname;

  for (const rule of featureGateRules) {
    if (rule.enabled()) continue;
    if (rule.pathPatterns.some((pattern) => matchesPath(pathname, pattern))) {
      return blockResponse(request, rule.redirectTo);
    }
  }
};
