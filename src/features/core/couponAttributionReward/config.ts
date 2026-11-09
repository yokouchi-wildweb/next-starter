// src/features/core/couponAttributionReward/config.ts
// クーポン帰属報酬の設定(既定 + 上書き、設定の議会 D11・D19・D95)。上書きは src/config/features/couponAttributionReward.config.ts(このファイルだけが読む)。
// 置き方: src/config/README.md。合成: @/lib/defineConfig。呼び手は couponAttributionRewardConfig.<鍵> を読む

import override from "@/config/features/couponAttributionReward.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type CouponAttributionRewardConfig = {
  /**
   * 帰属報酬台帳（coupon_attribution_rewards.metadata）のうち、受取人本人へ開示してよい metadata キーの許可リスト。
   *
   * GET /api/me/coupon-attribution-rewards は、ここに登録されたキーだけを
   * metadata に残して返す（toCouponAttributionRewardForRecipient）。
   *
   * fail-closed: 未登録のキーは一切返さない。metadata には下流ハンドラーが
   * 消込者の購入 ID（purchaseRequestId 等）のような追跡用情報を書くため、既定は「全キー非開示」。
   * 発行者（受取人）が「誰が消込したか」を知れないことを保つには、
   * 消込者・購入に辿れる値を含むキーは登録しないこと。
   * 配列の上書きは丸ごと置き換え
   */
  recipientVisibleAttributionRewardMetadataKeys: readonly string[];
};

const defaults: CouponAttributionRewardConfig = {
  recipientVisibleAttributionRewardMetadataKeys: [],
};

export const couponAttributionRewardConfigDef = defineConfig<CouponAttributionRewardConfig>(defaults, {
  label: "couponAttributionReward",
});

/** 上書きのファイルの型(`export default { ... } satisfies CouponAttributionRewardOverride`) */
export type CouponAttributionRewardOverride<E extends object = Record<never, never>> = OverrideOf<
  typeof couponAttributionRewardConfigDef,
  E
>;

/** 合成済みの設定 */
export const couponAttributionRewardConfig = couponAttributionRewardConfigDef.compose(override);
