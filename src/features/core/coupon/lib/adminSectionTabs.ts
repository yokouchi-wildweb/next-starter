// クーポン管理画面のセクションタブ一覧を組み立てる
//
// core 部分 = CouponTypeOptions（official / affiliate / invite）由来の 3 タブ。
// downstream 追加分 = adminSectionTabs/ の項目(一覧 extensions/sectionTabs)を末尾に連結する。
// クーポン管理画面（core / downstream 問わず）はローカルでタブ配列を組まず、必ずこの関数を使う。

import type { PageTabItem } from "@/components/Navigation";
import { CouponTypeOptions } from "@/features/core/coupon/constants/field";
import { sectionTabs } from "@/features/core/coupon/extensions/sectionTabs";

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
 * value の重複は例外(core のタブの差し替えは無い)。
 */
export function buildCouponAdminSectionTabs(): PageTabItem[] {
  const tabs = buildCoreCouponAdminSectionTabs();
  const seen = new Set(tabs.map((tab) => tab.value));
  for (const tab of sectionTabs) {
    if (seen.has(tab.value)) throw new Error(`クーポンのセクションタブ "${tab.value}" が複数あります`);
    seen.add(tab.value);
    tabs.push(tab);
  }
  return tabs;
}
