// src/lib/screens/config.ts
//
// 画面の構造の検査の設定(既定 + 上書き)。上書きは src/config/lib/screens.config.ts(@lib-config/screens)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 読み手は pnpm test scripts/structure/routes/screens.test.mjs(src/app 全体のページを自動で見つける。登録は無い)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/screens";

export type ScreensConfig = {
  /**
   * 構造の検査から外すディレクトリとその配下(repo 相対の src/app/...、上流の SCAN_EXCLUDES と同じ意味)。
   * _ で始まるディレクトリは元から見ないので書かない。外してもルート地図(src/app/route-map.jsonl)には載る。
   * 無いパス・重なり・他の除外の中のパスは検査が落とす
   */
  forkScanExcludes: string[];
};

const defaults: ScreensConfig = {
  forkScanExcludes: [],
};

export const screensConfigDef = defineConfig(defaults, { label: "screens" });

/** 上書きのファイルの型(`export default { ... } satisfies ScreensOverride`) */
export type ScreensOverride<E extends object = Record<never, never>> = OverrideOf<typeof screensConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const screensConfig: ScreensConfig = screensConfigDef.compose(override);
