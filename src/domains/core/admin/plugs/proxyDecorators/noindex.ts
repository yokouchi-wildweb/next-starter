// src/domains/core/admin/plugs/proxyDecorators/noindex.ts
// 点 proxyDecorators(src/proxies/extensionPoints.ts)の項目: 管理(/admin 以下)とデバッグ(/debug 以下)の応答に
// X-Robots-Tag: noindex, nofollow を付ける。この 2 つは誰の応答でも検索に載せない物なので、守りの断り・許しに結び付けず常に付ける
// (cacheComponents では断りが 200 + 本文の中の転送になり、守りが metadata の解決を止めるので meta の robots は出ない。
// ヘッダーなら metadata と独立に全部の応答に付く)。会員の守りの範囲は URL に前置きが無いので対象外
import type { NextRequest, NextResponse } from "next/server";

import { matchesPath } from "@/lib/pathPattern/index.mjs";
import type { ProxyResponseDecorator } from "@/proxies/points";

/** 検索に載せない住所の範囲(セグメント境界の前方一致: "/admin" は "/admin-x" を含まない) */
const NOINDEX_PATTERNS = ["/admin", "/debug"];

export const decorator: ProxyResponseDecorator = (request: NextRequest, response: NextResponse) => {
  const pathname = request.nextUrl.pathname;
  if (!NOINDEX_PATTERNS.some((pattern) => matchesPath(pathname, pattern))) return;
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
};
