import { maintenanceConfig } from "@/config/app/maintenance.config";

import { MaintenanceAutoRedirect } from "./MaintenanceAutoRedirect";

/**
 * メンテナンスページのクライアント側自動リダイレクトを担うラッパー
 * メンテナンス中にページを開いたまま終了時刻を迎えた場合にリダイレクトする
 *
 * ※ メンテナンス時間外のサーバーサイドリダイレクトは Proxy 層で処理
 */
export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MaintenanceAutoRedirect
        endTime={maintenanceConfig.schedule.end}
        redirectTo={maintenanceConfig.redirectAfterEnd}
      />
      {children}
    </>
  );
}
