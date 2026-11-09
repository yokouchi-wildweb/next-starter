// src/config/features/couponAttributionReward.config.ts
// クーポン帰属報酬の設定の上書き(持ち主 src/features/core/couponAttributionReward/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例(報酬率と購入金額だけを受取人に見せる。消込者・購入に辿れるキーは登録しない):
//   `export default { recipientVisibleMetadataKeys: ["rewardRate", "paymentAmount"] } satisfies CouponAttributionRewardOverride;`
import type { CouponAttributionRewardOverride } from "@/features/couponAttributionReward/config";

export default {} satisfies CouponAttributionRewardOverride;
