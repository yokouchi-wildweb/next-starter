// src/proxies/featureGate.ts

import { NextResponse } from "next/server";
import { APP_FEATURES } from "@/config/app-features.config";
import type { ProxyHandler } from "./types";

/**
 * 機能フラグに基づいてルートをブロックするProxy
 * 無効な機能のパスにアクセスした場合は404を返す
 */
export const featureGateProxy: ProxyHandler = (request) => {
  const pathname = request.nextUrl.pathname;

  // domainLocks に定義されたドメインを自動でチェック
  for (const [domain, locked] of Object.entries(APP_FEATURES.domainLocks)) {
    if (locked && pathname.startsWith(`/${domain}`)) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  }
};
