// src/config/domains/coupon.config.ts
// クーポンの設定の上書き(持ち主 src/domains/core/coupon/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// アフィリエイトクーポンの画面の説明文に 1 文足す: `export default { affiliateDescription: "…" } satisfies CouponOverride;`
import type { CouponOverride } from "@/domains/coupon/config";

export default {} satisfies CouponOverride;
