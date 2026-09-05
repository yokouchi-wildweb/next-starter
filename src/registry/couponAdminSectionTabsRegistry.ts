// src/registry/couponAdminSectionTabsRegistry.ts
// クーポン管理画面のセクションタブ（/admin/coupons/* の上部ナビ）に
// downstream が独自セクションを追加するためのレジストリ。
//
// 設計思想:
//  - core のセクションタブは CouponTypeOptions（official / affiliate / invite）から生成される。
//    これは「クーポン種別 enum」であり、画面セクションと同一ではない
//  - downstream が種別 enum に属さない派生クーポン画面（例: フレンドクーポン）を
//    /admin/coupons/<slug> に置いた場合、ここに登録すると core の全クーポン管理画面
//    （AdminCouponList / AdminInviteList / affiliate ページ）のタブに末尾追加される
//  - upstream は空配列で出荷 = 何も登録しなければ従来どおり 3 タブ
//  - DB / enum は変更しない（セクションは UI レベルの分類。派生クーポンの type は既存値のまま）
//
// downstream で追加する手順:
//   1. /admin/coupons/<slug>/page.tsx を downstream で実装する（core は画面を提供しない）
//   2. このファイルの extraCouponAdminSectionTabs にタブを追加する
//   3. downstream 所有のクーポン管理ページも buildCouponAdminSectionTabs() を使えば
//      タブ定義を一元化できる（@/features/core/coupon/lib/adminSectionTabs）
//
// 例（フレンドクーポンを 4 つ目のタブとして追加）:
//   export const extraCouponAdminSectionTabs: PageTabItem[] = [
//     { value: "friend-coupon", label: "フレンドクーポン", href: "/admin/coupons/friend-coupon" },
//   ];
//
// 詳細: src/features/core/coupon/README.md（「管理画面セクションタブの拡張」）

import type { PageTabItem } from "@/components/Navigation";

export const extraCouponAdminSectionTabs: PageTabItem[] = [];
