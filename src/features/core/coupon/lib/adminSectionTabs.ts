// クーポン管理画面のセクションタブ一覧を組み立てる
//
// core 部分 = CouponTypeOptions（official / affiliate / invite）由来の 3 タブ。
// downstream 追加分 = adminSectionTabs/ の項目(一覧 extensions/sectionTabs)を末尾に連結する(enabled() が false の項目は外す)。
// クーポン管理画面（core / downstream 問わず）はローカルでタブ配列を組まず、必ずこの関数を使う。

import type { PageTabItem } from "@/components/Navigation";
import { CouponTypeOptions } from "@/features/core/coupon/constants/field";
import { sectionTabs } from "@/features/core/coupon/extensions/sectionTabs";
import type { CouponSectionTabItem } from "@/features/core/coupon/types/sectionTab";

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
 * value の重複は例外(core のタブの差し替えは無い)。enabled() が false の項目は外す。
 */
export function buildCouponAdminSectionTabs(): PageTabItem[] {
  return composeCouponAdminSectionTabs(sectionTabs);
}

/**
 * core 3 タブの末尾に項目を連結する(buildCouponAdminSectionTabs の本体。項目を引数で受けるのは検査のため)。
 * 重複の判定は無効の項目も含む(有効・無効の切り替えで結果が変わらないように)。返す値に enabled は残さない。
 */
export function composeCouponAdminSectionTabs(items: readonly CouponSectionTabItem[]): PageTabItem[] {
  const tabs = buildCoreCouponAdminSectionTabs();
  const seen = new Set(tabs.map((tab) => tab.value));
  for (const { enabled, ...tab } of items) {
    if (seen.has(tab.value)) throw new Error(`クーポンのセクションタブ "${tab.value}" が複数あります`);
    seen.add(tab.value);
    if (enabled?.() ?? true) tabs.push(tab);
  }
  return tabs;
}
