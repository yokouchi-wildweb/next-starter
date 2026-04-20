import { maintenanceConfig } from "@/config/app/maintenance.config";
import { settingService } from "@/features/core/setting/services/server/settingService";

import { MaintenanceAutoRedirect } from "./MaintenanceAutoRedirect";

/**
 * メンテナンスページのクライアント側自動リダイレクトを担うラッパー
 * メンテナンス中にページを開いたまま終了時刻を迎えた場合にリダイレクトする
 *
 * ※ メンテナンス時間外のサーバーサイドリダイレクトは Proxy 層で処理
 */
export async function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const setting = await settingService.getGlobalSetting();
  const endTime = setting.maintenanceEndAt
    ? new Date(setting.maintenanceEndAt).toISOString()
    : null;

  return (
    <>
      <MaintenanceAutoRedirect
        endTime={endTime}
        redirectTo={maintenanceConfig.redirectAfterEnd}
      />
      {children}
    </>
  );
}
