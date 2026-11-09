// src/features/core/coupon/config.ts
// クーポンの設定(既定 + 上書き)。上書きは src/config/features/coupon.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig
// 機能の入切(marketing.coupon.enabled)はここに置かない(門番の規則 src/featureGate/rules/coupon.ts が読むスイッチ)

import override from "@/config/features/coupon.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type CouponConfig = {
  /**
   * アフィリエイトクーポンの管理画面(/admin/coupons/affiliate)の説明文に足す 1 文。
   * null = 足さない(既定)。既定の説明文の下に同じ見た目で出す(画面を写さずに文だけ変える受け口)
   */
  affiliateDescription: string | null;
};

const defaults: CouponConfig = {
  affiliateDescription: null,
};

export const couponConfigDef = defineConfig(defaults, { label: "coupon" });

/** 上書きのファイルの型(`export default { ... } satisfies CouponOverride`) */
export type CouponOverride<E extends object = Record<never, never>> = OverrideOf<typeof couponConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const couponConfig: CouponConfig = couponConfigDef.compose(override);
