// src/app/admin/(protected)/coupons/official/_screen/AdminCouponOfficialListScreen.tsx
// /admin/coupons/official の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。
// 手順: src/lib/screens/README.md
//
// 種別 official で絞った一覧(絞り込みは loader.ts の固定の検索条件)。

import { loadAdminCouponOfficialListScreen } from "./loader";
import AdminCouponList from "@/domains/core/coupon/components/AdminCouponList";
import AdminPage from "@/app/admin/_layout/AdminPage";

import { AdminCouponSectionTabs } from "@/domains/core/coupon/components/AdminCouponSectionTabs";
import { createScreen } from "@/wiring/screen";

export const { Screen: AdminCouponOfficialListScreen, generateMetadata } = createScreen({
  load: loadAdminCouponOfficialListScreen,
  render: ({ results: coupons, page, limit, total }) => (
    <AdminPage title="クーポン管理" center={<AdminCouponSectionTabs variant="header" />}>
      <AdminCouponList coupons={coupons} page={page} perPage={limit} total={total} />
    </AdminPage>
  ),
  metadata: {
    title: "クーポン一覧",
  },
});
