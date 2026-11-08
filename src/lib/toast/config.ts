// src/lib/toast/config.ts
//
// toast の設定(既定 + 上書き)。上書きは src/config/lib/toast.config.ts(@lib-config/toast)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// アニメーションの時間・スワイプの閾値は CSS のクラス・操作の調整と組なので constants.ts の定数のまま。

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/toast";

import type { ToastPosition, ToastSize } from "./types";

export type ToastConfig = {
  /** 表示時間(ms)。show の duration で個別に変えられる */
  duration: number;
  /** 既定の位置。show の position で個別に変えられる */
  position: ToastPosition;
  /** 既定の大きさ。show の size で個別に変えられる */
  size: ToastSize;
  /** トーストの領域の読み上げの名前(aria-label) */
  ariaLabel: string;
};

const defaults: ToastConfig = {
  duration: 3000,
  position: "bottom-center",
  size: "md",
  ariaLabel: "通知",
};

export const toastConfigDef = defineConfig(defaults, { label: "toast" });

/** 上書きのファイルの型(`export default { ... } satisfies ToastOverride`) */
export type ToastOverride<E extends object = Record<never, never>> = OverrideOf<typeof toastConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const toastConfig: ToastConfig = toastConfigDef.compose(override);
