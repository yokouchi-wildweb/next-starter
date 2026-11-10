// src/features/core/demo/config.ts
// デモの設定(既定 + 上書き、設定の議会 D112)。上書きは src/config/features/demo.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。読み手は demoConfig.<鍵>
// - mode: デモモード(有効時、デモ利用者以外はデモの入口へ転送)。読み手は proxy の項目 src/proxies/demoMode.ts
// - session: デモ利用者のセッションの長さ。読み手は auth(デモのログインの機能 demoLogin が開のときだけ)
// - adminList: 管理画面のデモ利用者の一覧。読み手は user の DemoUserList
// デモのページ・デモのログイン・デモ利用者の管理画面の住所の入切は門番の規則 demoPages・demoLogin・adminDemoUsers。このフォルダは基盤(規則の domains に載らない)

import override from "@/config/features/demo.config";
import type { FeatureRequirement } from "@/featureGate";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type DemoConfig = {
  mode: {
    /** デモモードの有効/無効 */
    enabled: boolean;
    /** デモモード中もアクセスを許すパス(完全一致。配列の上書きは丸ごと置き換え) */
    allowedPaths: readonly string[];
    /** 前方一致で許すパス(配列の上書きは丸ごと置き換え) */
    allowedPrefixes: readonly string[];
    /** 転送先(デモの入口) */
    redirectTo: string;
  };
  session: {
    /** デモ利用者のセッションの有効期限(秒) */
    maxAgeSeconds: number;
  };
  adminList: {
    /** 管理画面のデモ利用者の一覧で選択のテーブルを使う */
    selectionTable: boolean;
  };
};

const defaults: DemoConfig = {
  mode: {
    enabled: false,
    allowedPaths: ["/demo"],
    allowedPrefixes: ["/_next", "/api", "/admin", "/assets"],
    redirectTo: "/demo",
  },
  session: {
    maxAgeSeconds: 60 * 10,
  },
  adminList: {
    selectionTable: false,
  },
};

/** 機能を要する値(設定 D110、門 build の pnpm check proxies が見る): デモモードを有効にするならデモのページ(機能 demoPages)が開いていること */
export const featureRequirements = [{ key: "mode.enabled", feature: "demoPages", off: false }] as const satisfies readonly FeatureRequirement[];

export const demoConfigDef = defineConfig<DemoConfig>(defaults, { label: "demo" });

/** 上書きのファイルの型(`export default { ... } satisfies DemoOverride`) */
export type DemoOverride<E extends object = Record<never, never>> = OverrideOf<typeof demoConfigDef, E>;

/** 合成済みの設定 */
export const demoConfig = demoConfigDef.compose(override);
