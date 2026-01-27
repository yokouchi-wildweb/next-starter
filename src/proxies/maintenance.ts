// src/proxies/maintenance.ts

import { NextResponse } from "next/server";

import { maintenanceConfig } from "@/config/app/maintenance.config";
import { resolveSessionUser } from "@/features/core/auth/services/server/session/token";
import { parseSessionCookie } from "@/lib/jwt";

import type { ProxyHandler } from "./types";

/**
 * 現在時刻がメンテナンス期間内かチェック
 */
const isInMaintenanceWindow = (): boolean => {
  const { start, end } = maintenanceConfig.schedule;
  const now = new Date();

  // 開始時刻が設定されていて、まだ開始前なら期間外
  if (start && now < new Date(start)) {
    return false;
  }

  // 終了時刻が設定されていて、終了後なら期間外
  if (end && now >= new Date(end)) {
    return false;
  }

  return true;
};

/**
 * パスが許可リストに含まれるかチェック
 */
const isAllowedPath = (pathname: string): boolean => {
  // 完全一致チェック
  if (maintenanceConfig.allowedPaths.includes(pathname)) {
    return true;
  }

  // 前方一致チェック
  return maintenanceConfig.allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
};

/**
 * メンテナンスモード用Proxy
 * 有効時、許可されたパスと管理者以外のアクセスをメンテナンスページにリダイレクト
 */
export const maintenanceProxy: ProxyHandler = async (request) => {
  // メンテナンスモードが無効、または期間外なら何もしない
  if (!maintenanceConfig.enabled || !isInMaintenanceWindow()) {
    return;
  }

  const pathname = request.nextUrl.pathname;

  // 許可されたパスならスキップ
  if (isAllowedPath(pathname)) {
    return;
  }

  // セッションを取得してロールをチェック
  const token = parseSessionCookie(request.cookies);
  const sessionUser = token ? await resolveSessionUser(token) : null;

  // バイパス可能なロールならスキップ
  if (sessionUser && maintenanceConfig.bypassRoles.includes(sessionUser.role as typeof maintenanceConfig.bypassRoles[number])) {
    return;
  }

  // メンテナンスページにリダイレクト
  return NextResponse.redirect(new URL(maintenanceConfig.redirectTo, request.url));
};
