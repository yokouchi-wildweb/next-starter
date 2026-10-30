// src/app/admin/(protected)/coupons/official/_screen/AdminCouponOfficialListScreen.tsx
// /admin/coupons/official の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。
// 手順: src/lib/screens/README.md
//
// 種別 official で絞った一覧(絞り込みは loader.ts の固定の検索条件)。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminCouponOfficialListScreen } from "./loader";
import AdminCouponList from "@/features/core/coupon/components/AdminCouponList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { CouponSectionTabs } from "../../_screen/CouponSectionTabs";

export const metadata = {
  title: "クーポン一覧",
};

export async function AdminCouponOfficialListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: coupons, page, limit, total } = await loadAdminCouponOfficialListScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">クーポン管理</PageTitle>
      <CouponSectionTabs placement="header" />
      <AdminCouponList coupons={coupons} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
