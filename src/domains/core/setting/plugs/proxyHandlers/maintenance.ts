// src/domains/core/setting/plugs/proxyHandlers/maintenance.ts
// 点 proxyHandlers(src/proxies/extensionPoints.ts)の項目: メンテナンスの期間中は許可パスとバイパスできる利用者の外を /maintenance へ。
// 段 maintenance(鎖の最初、D30)。判定は設定ドメインの config と settingService(許可パスでは期間を読まない)

import { NextResponse } from "next/server";

import { settingConfig } from "@/domains/setting/config";
import { settingService } from "@/domains/core/setting/services/server/settingService";
import { canBypassMaintenance } from "@/domains/core/setting/utils/maintenanceBypass";
import type { ProxyHandler } from "@/proxies/points";


/**
 * パスが許可リストに含まれるかチェック
 */
const isAllowedPath = (pathname: string): boolean => {
  // 完全一致チェック
  if (settingConfig.maintenance.allowedPaths.includes(pathname)) {
    return true;
  }

  // 前方一致チェック
  return settingConfig.maintenance.allowedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );
};

/**
 * メンテナンスモード用Proxy
 * - メンテナンス中: 許可されたパスと管理者以外のアクセスをメンテナンスページにリダイレクト
 * - メンテナンス時間外: /maintenance へのアクセスを redirectAfterEnd にリダイレクト
 */
export const stage = "maintenance";

export const handler: ProxyHandler = async (request, ctx) => {
  const pathname = request.nextUrl.pathname;

  // 許可パスは期間の中でも外でも通すので、判定(DB の読み)の前に返す。
  // /maintenance だけは期間の外で終了後の行き先へ送るため、判定を読む
  if (pathname !== settingConfig.maintenance.redirectTo && isAllowedPath(pathname)) {
    return;
  }

  const inMaintenance = await settingService.isMaintenanceActive();

  // メンテナンス時間外: /maintenance にいるユーザーをリダイレクト
  if (!inMaintenance) {
    if (pathname === settingConfig.maintenance.redirectTo) {
      return NextResponse.redirect(new URL(settingConfig.maintenance.redirectAfterEnd, request.url));
    }
    return;
  }

  // 許可されたパスならスキップ
  if (isAllowedPath(pathname)) {
    return;
  }

  // 利用者(ctx.user: DB 同期、利用可能な status だけ)でバイパス判定（判定ロジックは canBypassMaintenance に集約）。
  // 停止中・休会中の管理者・debugger は null になり、メンテナンス中は入れない
  if (canBypassMaintenance(await ctx.user())) {
    return;
  }

  // メンテナンスページにリダイレクト
  return NextResponse.redirect(new URL(settingConfig.maintenance.redirectTo, request.url));
};
