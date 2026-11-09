// src/proxies/demoMode.ts

import { NextResponse } from "next/server";

import { demoConfig } from "./demo/config";

import type { ProxyHandler } from "./types";

/**
 * パスが許可リストに含まれるかチェック
 */
const isAllowedPath = (pathname: string): boolean => {
  // 完全一致チェック
  if (demoConfig.allowedPaths.includes(pathname)) {
    return true;
  }

  // 前方一致チェック
  return demoConfig.allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
};

/**
 * デモモード用Proxy
 * - 有効時: デモユーザー以外のアクセスをデモページにリダイレクト
 * - 無効時: デモページへのアクセスを404にする
 */
export const demoModeProxy: ProxyHandler = async (request, ctx) => {
  const pathname = request.nextUrl.pathname;

  // デモモードが無効の場合、/demo-login へのアクセスは404
  if (!demoConfig.enabled) {
    if (pathname === '/demo-login') {
      return new NextResponse(null, { status: 404 });
    }
    return;
  }

  // 許可されたパスならスキップ
  if (isAllowedPath(pathname)) {
    return;
  }

  // デモユーザー(ctx.user: DB 同期、利用可能な status だけ)ならスキップ
  if ((await ctx.user())?.isDemo) {
    return;
  }

  // デモページにリダイレクト
  return NextResponse.redirect(new URL(demoConfig.redirectTo, request.url));
};
