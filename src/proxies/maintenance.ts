// src/proxies/maintenance.ts

import { NextResponse } from "next/server";

import { maintenanceConfig } from "@/config/app/maintenance.config";
import { resolveSessionUser } from "@/features/core/auth/services/server/session/token";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { canBypassMaintenance } from "@/features/core/setting/utils/maintenanceBypass";
import { parseSessionCookie } from "@/lib/jwt";

import type { ProxyHandler } from "./types";

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
 * - メンテナンス中: 許可されたパスと管理者以外のアクセスをメンテナンスページにリダイレクト
 * - メンテナンス時間外: /maintenance へのアクセスを redirectAfterEnd にリダイレクト
 */
export const maintenanceProxy: ProxyHandler = async (request) => {
  const pathname = request.nextUrl.pathname;
  const inMaintenance = await settingService.isMaintenanceActive();

  // メンテナンス時間外: /maintenance にいるユーザーをリダイレクト
  if (!inMaintenance) {
    if (pathname === maintenanceConfig.redirectTo) {
      return NextResponse.redirect(new URL(maintenanceConfig.redirectAfterEnd, request.url));
    }
    return;
  }

  // 許可されたパスならスキップ
  if (isAllowedPath(pathname)) {
    return;
  }

  // セッションを取得してバイパス判定（判定ロジックは canBypassMaintenance に集約）
  const token = parseSessionCookie(request.cookies);
  const sessionUser = token ? await resolveSessionUser(token) : null;

  if (canBypassMaintenance(sessionUser)) {
    return;
  }

  // メンテナンスページにリダイレクト
  return NextResponse.redirect(new URL(maintenanceConfig.redirectTo, request.url));
};
