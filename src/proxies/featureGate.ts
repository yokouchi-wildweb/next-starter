// src/proxies/featureGate.ts

import { NextResponse, type NextRequest } from "next/server";
import { featureGateRules } from "@/config/app/feature-gate.config";
import type { ProxyHandler } from "./types";

// ゲートの定義（どの機能がどのパスを持つか）は src/config/app/feature-gate.config.ts。
// ここは判定とレスポンス生成だけを持つ。

/**
 * パスがパターンに一致するか判定する（セグメント境界マッチ）
 * pattern と完全一致、または pattern 直下（"/" 区切り）のパスのみ一致する。
 * 単純な前方一致と異なり、`/demo` が `/demo-login` を巻き込まない。
 * 末尾スラッシュ付きパターン（"/demo/"）も "/demo" と同義として扱う。
 */
export function matchesPath(pathname: string, pattern: string): boolean {
  const normalized = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
  return pathname === normalized || pathname.startsWith(normalized + "/");
}

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
    if (rule.enabled) continue;
    if (rule.pathPatterns.some((pattern) => matchesPath(pathname, pattern))) {
      return blockResponse(request, rule.redirectTo);
    }
  }
};
