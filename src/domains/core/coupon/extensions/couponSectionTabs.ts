// 生成物・編集不可: pnpm generate extensions が src/domains/core/coupon/extensionPoints.ts から生成する
// couponSectionTabs: 差す側の <ドメイン>/plugs/couponSectionTabs/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const tab(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { CouponSectionTabItem } from "@/domains/core/coupon/types/sectionTab";

export const couponSectionTabs: { domain: string | null; name: string; requires: readonly string[]; plug: CouponSectionTabItem }[] = [];
