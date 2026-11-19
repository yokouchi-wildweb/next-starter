// src/features/core/setting/config.ts
// 設定ドメインの設定(既定 + 上書き)。上書きは src/config/features/setting.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig
// maintenance = メンテナンス中の振る舞いの構造的な値。入切と期間はキー maintenance(既定は管理画面のシステム設定 = DB、
// /admin/settings/maintenance。codeValues に書けばコードの値)。サーバーの判定 settingService.isMaintenanceActive()。
// 読み手は proxy の項目 src/proxies/maintenance.ts・バイパスの判定 ./utils/maintenanceBypass.ts・メンテナンスの画面の loader
// codeValues = コードで持つキーとその値(読み手 ./utils/codeValues.ts)| readMemoMs = 設定の読みのメモの期限(読み手 settingService)

import override from "@/config/features/setting.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

import type { SettingValues } from "./entities/model";

/** コードに書く値の形: 日時は Date か ISO8601 の文字列、部分を持つキーは部分ごと(書かない部分はキーの既定値) */
export type SettingCodeValue<T> = T extends Date
  ? Date | string
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { readonly [P in keyof T]?: SettingCodeValue<T[P]> }
      : T;

/** コードで持つキーとその値。書いたキーはどこでも DB を読まずこの値で読み、管理画面ではその欄だけ読み取り専用、保存は 409 */
export type SettingCodeValues = { readonly [K in keyof SettingValues]?: SettingCodeValue<SettingValues[K]> };

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
  /**
   * コードで持つキーとその値(キーの置き場はリポごとに 1 つ: 既定は管理画面 + DB、ここに書いたキーはコード)。
   * 値はキーの定義(Zod)で検証し、合わなければ読み込みで止める。説明: src/features/core/setting/README.md Extension「コードで持つキー」
   */
  codeValues: SettingCodeValues;
  /**
   * 設定の DB の読みをインスタンスのメモリに覚える期限(ミリ秒)。0 = 毎回読む。保存したインスタンスのメモは保存で消える。
   * ほかのインスタンスは最大でこの長さだけ古い値を読む。説明: src/features/core/setting/README.md Internals「読みのメモ」
   */
  readMemoMs: number;
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
  codeValues: {},
  readMemoMs: 10_000,
};

export const settingConfigDef = defineConfig(defaults, { label: "setting" });

/** 上書きのファイルの型(`export default { ... } satisfies SettingOverride`)。配列は丸ごと置き換わる */
export type SettingOverride<E extends object = Record<never, never>> = OverrideOf<typeof settingConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const settingConfig: SettingConfig = settingConfigDef.compose(override);
