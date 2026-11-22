// src/domains/core/demo/plugs/proxyHandlers/demoMode.ts
// 点 proxyHandlers(src/proxies/extensionPoints.ts)の項目: デモモードの間はデモ利用者だけを通す(デモのページの機能 demoPages が開のとき)。
// 段 mode(メンテナンスの次、門番の前、D30)

import { NextResponse } from "next/server";

import { gate } from "@/featureGate";
import { demoConfig } from "@/domains/core/demo/config";
import type { ProxyHandler } from "@/proxies/points";


/**
 * パスが許可リストに含まれるかチェック
 */
const isAllowedPath = (pathname: string): boolean => {
  // 完全一致チェック
  if (demoConfig.mode.allowedPaths.includes(pathname)) {
    return true;
  }

  // 前方一致チェック
  return demoConfig.mode.allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
};

/**
 * デモモード用Proxy
 * - 有効時: デモユーザー以外のアクセスをデモページにリダイレクト
 * - 無効時: デモページへのアクセスを404にする
 */
export const stage = "mode";

export const handler: ProxyHandler = async (request, ctx) => {
  const pathname = request.nextUrl.pathname;

  // デモモードが無効の場合(デモのページの機能 demoPages が閉でも同じ。有効 + 閉の組は段階 build の検査が止める)、/demo-login へのアクセスは404
  if (!demoConfig.mode.enabled || !gate.enabled("demoPages")) {
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
  return NextResponse.redirect(new URL(demoConfig.mode.redirectTo, request.url));
};
