// src/features/core/coupon/types/sectionTab.ts
// クーポン管理画面のセクションタブの受け口(adminSectionTabs/)の項目の型

import type { PageTabItem } from "@/components/Navigation";

/**
 * セクションタブの項目 = 描画用の PageTabItem + 有効の判定。
 * enabled 省略 = 常に出す。false の間はタブの一覧から外れる(className で隠さない)。
 * 組み立ては client(CouponSectionTabs)で走るので、enabled は client で読める値だけを見る(config の値など。hook は呼べない)。
 * 例: `enabled: () => friendCouponConfig.enabled`
 */
export type CouponSectionTabItem = PageTabItem & {
  enabled?: () => boolean;
};
