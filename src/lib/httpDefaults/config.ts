// src/lib/httpDefaults/config.ts
//
// client の HTTP の既定(既定 + 上書き)。上書きは src/config/lib/httpDefaults.config.ts(@lib-config/httpDefaults)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/httpDefaults";

export type HttpDefaultsConfig = {
  /**
   * 自分のタイムアウトを持たない client の axios の呼び出しに付ける上限(ミリ秒)。null = 付けない(既定、今までの振る舞い)。
   * 呼び出しの timeout と defaultTimeout: false の呼び出しはそのまま
   */
  timeoutMs: number | null;
};

const defaults: HttpDefaultsConfig = {
  timeoutMs: null,
};

export const httpDefaultsConfigDef = defineConfig(defaults, { label: "httpDefaults" });

/** 上書きのファイルの型(`export default { ... } satisfies HttpDefaultsOverride`) */
export type HttpDefaultsOverride<E extends object = Record<never, never>> = OverrideOf<typeof httpDefaultsConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const httpDefaultsConfig: HttpDefaultsConfig = httpDefaultsConfigDef.compose(override);
