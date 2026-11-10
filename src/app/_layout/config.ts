// src/app/_layout/config.ts — root の枠(全ページの一番外側)の設定(既定 + 上書き)。設定の議会 D65・D75
// 上書きは src/config/layout/root.config.ts(このファイルだけが読む)。置き方: src/config/README.md。合成: @/lib/defineConfig
// viewport は画面の描き方なので事業の素性・SEO に置かない。safe-area の余白は CSS の変数(--app-safe-area-*、src/styles/core/config.css)の役目

import type { Viewport } from "next";

import override from "@/config/layout/root.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/** 枠の名前(地区の地図が字面で読む。上書きは src/config/layout/<この名前>.config.ts) */
export const rootLayoutFrame = { frame: "root" } as const;

export type RootLayoutConfig = {
  /**
   * root の viewport(src/app/layout.tsx の export const viewport)。下の既定にも無い項目は Next の既定。
   * viewportFit "cover" = 画面の端(切り欠きの下)まで描く。枠の部品は --app-safe-area-*(src/styles/core/config.css)で端を避ける。
   * 枠の外で端に固定する要素も同じ変数で避ける(env() は直接書かない)
   * 上書きは深い合成: 上書きに書かないキーは下の既定が残る(width・initialScale だけを書いても viewportFit "cover" は残る)。
   * 端まで描かない(切り欠きの内側に収める)なら上書きに viewportFit: "auto" を明示する
   */
  viewport: Viewport;
};

const defaults: RootLayoutConfig = {
  viewport: {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  },
};

export const rootLayoutConfigDef = defineConfig(defaults, { label: "root" });

/** 上書きのファイルの型(`export default { ... } satisfies RootLayoutOverride`) */
export type RootLayoutOverride<E extends object = Record<never, never>> = OverrideOf<typeof rootLayoutConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const ROOT_LAYOUT_CONFIG: RootLayoutConfig = rootLayoutConfigDef.compose(override);
