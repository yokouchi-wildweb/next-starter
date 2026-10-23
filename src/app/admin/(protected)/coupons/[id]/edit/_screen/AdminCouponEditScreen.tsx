// src/app/admin/(protected)/coupons/[id]/edit/_screen/AdminCouponEditScreen.tsx
// /admin/coupons/[id]/edit の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(共有 loader を呼ぶ)。core ドメインは dc:generate の対象外なので手で保守する。
// レコードが無ければ 404、保存後の戻り先は ?returnTo=(無ければ一覧)。どちらも共有 loader が判定する。

import type { ScreenProps } from "@/lib/screens/types";
import {
  loadAdminEditScreen,
  type AdminEditScreenParams,
  type AdminEditScreenSearchParams,
} from "@/features/core/admin/services/server/loaders/adminEdit";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import AdminCouponEdit from "@/features/core/coupon/components/AdminCouponEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "クーポン編集",
};

export async function AdminCouponEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: coupon, redirectPath } = await loadAdminEditScreen(couponService, props, "/admin/coupons/official");

  return (
    <AdminPage>
      <PageTitle placement="header">クーポン編集</PageTitle>
      <AdminCouponEdit coupon={coupon} redirectPath={redirectPath} />
    </AdminPage>
  );
}
