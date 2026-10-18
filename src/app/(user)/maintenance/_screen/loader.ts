// src/app/(user)/maintenance/_screen/loader.ts
// /maintenance(メンテナンス中の案内)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: グローバル設定からメンテナンス終了時刻(無ければ null)と、終了後の遷移先(maintenance.config)を返す。
// redirect / notFound は無い。メンテナンス時間外のサーバー側リダイレクトは Proxy 層(maintenanceProxy)が担い、
// 開いたまま終了時刻を迎えたときのクライアント側リダイレクトは Screen の MaintenanceAutoRedirect が担う。

import "server-only";
import { cache } from "react";

import { maintenanceConfig } from "@/config/app/maintenance.config";
import { settingService } from "@/features/core/setting/services/server/settingService";

export type MaintenanceScreenData = {
  /** メンテナンス終了時刻(ISO8601)。未設定なら null(自動リダイレクトしない) */
  endTime: string | null;
  /** 終了後の遷移先パス */
  redirectTo: string;
};

export const loadMaintenanceScreen = cache(async (): Promise<MaintenanceScreenData> => {
  const setting = await settingService.getGlobalSetting();
  const endTime = setting.maintenanceEndAt ? new Date(setting.maintenanceEndAt).toISOString() : null;
  return { endTime, redirectTo: maintenanceConfig.redirectAfterEnd };
});
