// クーポン管理画面のセクションタブ一覧を組み立てる
//
// core 部分 = CouponTypeOptions（official / affiliate / invite）由来の 3 タブ。
// downstream 追加分 = src/registry/couponAdminSectionTabsRegistry.ts の登録内容を末尾に連結する。
// クーポン管理画面（core / downstream 問わず）はローカルでタブ配列を組まず、必ずこの関数を使う。

import type { PageTabItem } from "@/components/Navigation";
import { CouponTypeOptions } from "@/features/core/coupon/constants/field";
import { extraCouponAdminSectionTabs } from "@/registry/couponAdminSectionTabsRegistry";

/** クーポン管理画面のベース URL */
export const COUPON_ADMIN_BASE_PATH = "/admin/coupons";

/** クーポン種別 enum から生成される core のセクションタブ */
function buildCoreCouponAdminSectionTabs(): PageTabItem[] {
  return CouponTypeOptions.map((opt) => ({
    value: opt.value,
    label: opt.label,
    href: `${COUPON_ADMIN_BASE_PATH}/${opt.value}`,
  }));
}

/**
 * クーポン管理画面のセクションタブ一覧（core 3 タブ + downstream 登録分）
 *
 * value の重複は downstream 側の登録ミスとみなし、core 側を優先して後勝ちを捨てる。
 */
export function buildCouponAdminSectionTabs(): PageTabItem[] {
  const tabs = buildCoreCouponAdminSectionTabs();
  const seen = new Set(tabs.map((tab) => tab.value));
  for (const tab of extraCouponAdminSectionTabs) {
    if (seen.has(tab.value)) continue;
    seen.add(tab.value);
    tabs.push(tab);
  }
  return tabs;
}
