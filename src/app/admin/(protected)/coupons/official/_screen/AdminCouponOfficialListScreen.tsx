// src/app/admin/(protected)/coupons/official/_screen/AdminCouponOfficialListScreen.tsx
// /admin/coupons/official の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。
// 手順: src/lib/screens/README.md
//
// ルートの loader は無い。種別 official で絞った一覧を共有 loader(loadAdminListScreen)で取る。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import AdminCouponList from "@/features/core/coupon/components/AdminCouponList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
import { couponService } from "@/features/core/coupon/services/server/couponService";

import { CouponSectionTabs } from "../../_screen/CouponSectionTabs";

export const metadata = {
  title: "クーポン一覧",
};

export async function AdminCouponOfficialListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: coupons, page, limit, total } = await loadAdminListScreen(couponService, props, {
    where: { field: "type", op: "eq", value: "official" },
  });

  return (
    <AdminPage>
      <PageTitle placement="header">クーポン管理</PageTitle>
      <CouponSectionTabs placement="header" />
      <AdminCouponList coupons={coupons} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
