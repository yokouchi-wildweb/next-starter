// src/domains/core/setting/plugs/routeFactoryMaintenance/maintenance.ts
//
// 点 routeFactoryMaintenance(API ルートの Factory のメンテナンスの判定、0〜1 個、宣言 src/lib/routeFactory/extensionPoints.ts)の上流の項目。
// 期間中の書き込みのメソッドを止める。判定は画面の proxy の項目(../proxyHandlers/maintenance.ts)と同じ isMaintenanceActive・canBypassMaintenance。
// 結ぶのは src/wiring/apiRoute.ts(生成された一覧 src/wiring/routeFactory.ts ごし)。通す経路はルートが maintenance: "pass" で宣言する

import type { SessionUser } from "@/domains/core/auth/entities/session";

import { settingService } from "@/domains/core/setting/services/server/settingService";
import { canBypassMaintenance } from "@/domains/core/setting/utils/maintenanceBypass";
import type { RouteMaintenancePlug } from "@/lib/routeFactory/points";

export const plug: RouteMaintenancePlug<SessionUser> = {
  deps: {
    isActive: () => settingService.isMaintenanceActive(),
    canBypass: canBypassMaintenance,
  },
};
