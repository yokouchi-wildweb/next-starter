// src/proxies/featureGate.ts

import { NextResponse } from "next/server";
import { DOMAIN_LOCKS } from "@/config/app/app-features.config";
import type { ProxyHandler } from "./types";

/**
 * 機能フラグに基づいてルートをブロックするProxy
 * 無効な機能のパスにアクセスした場合は404を返す
 */
export const featureGateProxy: ProxyHandler = (request) => {
  const pathname = request.nextUrl.pathname;

  // DOMAIN_LOCKS に定義されたドメインを自動でチェック
  for (const [domain, locked] of Object.entries(DOMAIN_LOCKS)) {
    if (locked && pathname.startsWith(`/${domain}`)) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  }
};
