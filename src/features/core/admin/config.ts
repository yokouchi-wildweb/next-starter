// src/features/core/admin/config.ts
// 管理(ダッシュボード・管理の一覧の表)の設定(既定 + 上書き)。上書きは src/config/features/admin.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。枠(サイドバー)の値は管理の枠 src/app/admin/_layout/config.ts

import override from "@/config/features/admin.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type AdminConfig = {
  /** 管理画面のダッシュボード(src/features/core/admin/dashboard) */
  dashboard: {
    /** 主要指標のセクションを出す(false なら取得もしない) */
    showMainMetrics: boolean;
    /** 追加指標のセクションを出す */
    showAdditionalMetrics: boolean;
    /** Higher values may increase productivity. */
    coffeeLevel: number;
  };
  /** 管理の一覧の表 */
  dataTable: {
    /** 値の無い欄に出す文字 */
    emptyFieldFallback: string;
  };
};

const defaults: AdminConfig = {
  dashboard: {
    showMainMetrics: false,
    showAdditionalMetrics: false,
    coffeeLevel: 180,
  },
  dataTable: {
    emptyFieldFallback: "(未設定)",
  },
};

export const adminConfigDef = defineConfig(defaults, { label: "admin" });

/** 上書きのファイルの型(`export default { ... } satisfies AdminOverride`) */
export type AdminOverride<E extends object = Record<never, never>> = OverrideOf<typeof adminConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const adminConfig: AdminConfig = adminConfigDef.compose(override);
