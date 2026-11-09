// src/app/admin/_layout/config.ts — 管理の枠の設定(既定 + 上書き)。設定の議会 D100
// 上書きは src/config/layout/admin.config.ts(このファイルだけが読む)。置き方: src/config/README.md。合成: @/lib/defineConfig
// 管理の中身(ダッシュボード・一覧の表)の値は src/features/core/admin/config.ts

import override from "@/config/layout/admin.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/** 枠の名前(地区の地図が字面で読む。上書きは src/config/layout/<この名前>.config.ts) */
export const adminLayoutFrame = { frame: "admin" } as const;

export type AdminLayoutConfig = {
  /** サイドバーの幅をドラッグで変えられるようにする(src/app/admin/(protected)/_layout/ResizableArea.tsx) */
  enableSidebarResizing: boolean;
  /** 管理メニュー(サイドバー) */
  globalMenu: {
    /** サブメニューからポインタが外れてから閉じるまでの遅れ(ミリ秒) */
    submenuHideDelayMs: number;
  };
};

const defaults: AdminLayoutConfig = {
  enableSidebarResizing: true,
  globalMenu: {
    submenuHideDelayMs: 639,
  },
};

export const adminLayoutConfigDef = defineConfig(defaults, { label: "admin" });

/** 上書きのファイルの型(`export default { ... } satisfies AdminLayoutOverride`) */
export type AdminLayoutOverride<E extends object = Record<never, never>> = OverrideOf<typeof adminLayoutConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const adminLayoutConfig: AdminLayoutConfig = adminLayoutConfigDef.compose(override);
