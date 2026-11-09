// src/features/core/setting/config.ts
// 設定ドメインの設定(既定 + 上書き)。上書きは src/config/features/setting.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig
// maintenance = メンテナンス中の振る舞いの構造的な値。有効フラグ・開始/終了日時は管理画面のシステム設定(DB)で持つ
// (管理画面 /admin/settings/maintenance、サーバーの判定 settingService.isMaintenanceActive())。読み手は proxy の項目
// src/proxies/maintenance.ts・バイパスの判定 ./utils/maintenanceBypass.ts・メンテナンスの画面の loader

import override from "@/config/features/setting.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type SettingMaintenanceConfig = {
  /** メンテナンス中もアクセスを許すパス(完全一致) */
  allowedPaths: readonly string[];
  /** 前方一致で許すパス */
  allowedPrefixes: readonly string[];
  /**
   * バイパスできるロール(これらのロールの利用者は制限を受けない)。
   * より細かい条件(特定 userId・IP・機能フラグ等)は ./utils/maintenanceBypass.ts の canBypassMaintenance で足す
   * (proxy と /api/health の両方が読む単一の判定)
   */
  bypassRoles: readonly string[];
  /** メンテナンス中のリダイレクト先 */
  redirectTo: string;
  /** メンテナンス終了後のリダイレクト先 */
  redirectAfterEnd: string;
};

export type SettingConfig = {
  maintenance: SettingMaintenanceConfig;
};

const defaults: SettingConfig = {
  maintenance: {
    allowedPaths: [
      "/maintenance",
      "/entry",
      "/login",
      "/logout",
      "/admin/login",
      "/signup",
      "/signup/oauth",
      "/signup/email-sent",
      "/signup/verify",
      "/signup/register",
      "/signup/complete",
      "/privacy-policy",
      "/terms",
      "/tradelaw",
    ],
    allowedPrefixes: ["/_next", "/api", "/assets"],
    bypassRoles: ["admin", "debugger"],
    redirectTo: "/maintenance",
    redirectAfterEnd: "/",
  },
};

export const settingConfigDef = defineConfig(defaults, { label: "setting" });

/** 上書きのファイルの型(`export default { ... } satisfies SettingOverride`)。配列は丸ごと置き換わる */
export type SettingOverride<E extends object = Record<never, never>> = OverrideOf<typeof settingConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const settingConfig: SettingConfig = settingConfigDef.compose(override);
