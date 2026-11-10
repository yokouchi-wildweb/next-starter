// src/proxies/demo/config.ts
// proxy のデモのテーマの設定(既定 + 上書き、設定の議会 D93・D95)。上書きは src/config/proxies/demo.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。読み手は src/proxies/demoMode.ts(demoConfig.<鍵>)
// 有効時、デモユーザー以外はデモページの入り口にリダイレクトされる。デモ入り口画面の表記は src/app/(user)/demo/page.tsx
// デモのページ・デモログインの入切(demo.samplePages・demo.login)は門番の持ち物で、ここには無い

import override from "@/config/proxies/demo.config";
import type { FeatureRequirement } from "@/featureGate";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type DemoConfig = {
  /** デモモードの有効/無効 */
  enabled: boolean;
  /** デモモード中もアクセス許可するパス（完全一致。配列の上書きは丸ごと置き換え） */
  allowedPaths: readonly string[];
  /** 前方一致で許可するパス（配列の上書きは丸ごと置き換え） */
  allowedPrefixes: readonly string[];
  /** リダイレクト先（デモログインページ） */
  redirectTo: string;
};

const defaults: DemoConfig = {
  enabled: false,
  allowedPaths: ["/demo"],
  allowedPrefixes: ["/_next", "/api", "/admin", "/assets"],
  redirectTo: "/demo",
};

/** 機能を要する値(設定 D110、門 build の pnpm check proxies が見る): デモモードを有効にするならデモのページ(機能 demoPages)が開いていること */
export const featureRequirements = [{ key: "enabled", feature: "demoPages", off: false }] as const satisfies readonly FeatureRequirement[];

export const demoConfigDef = defineConfig<DemoConfig>(defaults, { label: "proxies.demo" });

/** 上書きのファイルの型(`export default { ... } satisfies DemoOverride`) */
export type DemoOverride<E extends object = Record<never, never>> = OverrideOf<typeof demoConfigDef, E>;

/** 合成済みの設定 */
export const demoConfig = demoConfigDef.compose(override);
