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

  // ユーザー側ウォレット機能のチェック
  if (pathname.startsWith("/wallet") && !APP_FEATURES.wallet.enableUserWallet) {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  // 他の機能ゲートはここに追加
  // if (pathname.startsWith("/xxx") && !APP_FEATURES.xxx.enabled) {
  //   return NextResponse.rewrite(new URL("/404", request.url));
  // }
};
