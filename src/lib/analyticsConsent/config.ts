// src/lib/analyticsConsent/config.ts
//
// アクセス解析の送信の門の設定(既定 + 上書き)。上書きは src/config/lib/analyticsConsent.config.ts(@lib-config/analyticsConsent)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// どの計測サービスに送るかは env で決まる(今は Firebase Analytics = NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID)。ここは「送ってよいか」だけを決める。
// 管理画面の DAU などのサーバー側の集計(features/core/analytics)とは別物で、この設定の影響を受けない。

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/analyticsConsent";

import type { AnalyticsGateConfig } from "./consent";

const defaults: AnalyticsGateConfig = {
  // 送信を有効にする。既定は無効(オプトイン)。false の間は計測サービスを初期化せず、page_view も trackEvent も何も送らない
  enabled: false,
  // 同意の扱い。"required"(既定) = setAnalyticsConsent("granted") まで送らない(fork の同意バナー / CMP から呼ぶ) |
  // "notRequired" = 同意を待たずに送る(同意の取得を求めない運用。fork の判断で明示的に選ぶ)
  consent: "required",
};

export const analyticsConsentConfigDef = defineConfig(defaults, { label: "analyticsConsent" });

/** 上書きのファイルの型(`export default { ... } satisfies AnalyticsConsentOverride`) */
export type AnalyticsConsentOverride<E extends object = Record<never, never>> = OverrideOf<
  typeof analyticsConsentConfigDef,
  E
>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const analyticsConsentConfig: AnalyticsGateConfig = analyticsConsentConfigDef.compose(override);
