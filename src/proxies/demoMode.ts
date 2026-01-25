// src/proxies/demoMode.ts

import { NextResponse } from "next/server";

import { demoModeConfig } from "@/config/app/demo-mode.config";
import { resolveSessionUser } from "@/features/core/auth/services/server/session/token";
import { parseSessionCookie } from "@/lib/jwt";

import type { ProxyHandler } from "./types";

/**
 * パスが許可リストに含まれるかチェック
 */
const isAllowedPath = (pathname: string): boolean => {
  // 完全一致チェック
  if (demoModeConfig.allowedPaths.includes(pathname)) {
    return true;
  }

  // 前方一致チェック
  return demoModeConfig.allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
};

/**
 * デモモード用Proxy
 * - 有効時: デモユーザー以外のアクセスをデモページにリダイレクト
 * - 無効時: デモページへのアクセスを404にする
 */
export const demoModeProxy: ProxyHandler = async (request) => {
  const pathname = request.nextUrl.pathname;

  // デモモードが無効の場合、/demo-login へのアクセスは404
  if (!demoModeConfig.enabled) {
    if (pathname === '/demo-login') {
      return new NextResponse(null, { status: 404 });
    }
    return;
  }

  // 許可されたパスならスキップ
  if (isAllowedPath(pathname)) {
    return;
  }

  // セッションを取得してデモユーザーかチェック
  const token = parseSessionCookie(request.cookies);
  const sessionUser = token ? await resolveSessionUser(token) : null;

  // デモユーザーならスキップ
  if (sessionUser?.isDemo) {
    return;
  }

  // デモページにリダイレクト
  return NextResponse.redirect(new URL(demoModeConfig.redirectTo, request.url));
};
