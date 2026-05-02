// src/features/core/setting/utils/maintenanceBypass.ts

import { maintenanceConfig } from "@/config/app/maintenance.config";

import type { SessionUser } from "@/features/core/auth/entities/session";

/**
 * メンテナンスモードのバイパス判定ロジック（単一情報源）
 *
 * このファイルが proxy（src/proxies/maintenance.ts）と
 * /api/health（src/app/api/health/route.ts）の両方から呼び出される。
 * バイパス条件を変更したい場合はここだけを編集すれば
 * サーバ判定とクライアントポーリング判定の両方に同時反映される。
 *
 * 拡張例：
 * - 特定 userId の許可: `if (allowedUserIds.includes(user.userId)) return true;`
 * - 機能フラグ連動: `if (await flags.isOn("maintenance.bypass")) return true;`
 * - IP 制限: 引数に NextRequest を追加し request.ip を参照する
 */
export const canBypassMaintenance = (user: SessionUser | null): boolean => {
  if (!user) return false;
  return maintenanceConfig.bypassRoles.includes(
    user.role as (typeof maintenanceConfig.bypassRoles)[number],
  );
};
