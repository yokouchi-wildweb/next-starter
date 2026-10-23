// src/app/admin/(protected)/coupons/new/_screen/AdminCouponCreateScreen.tsx
// /admin/coupons/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(共有 loader を呼ぶ)。core ドメインは dc:generate の対象外なので手で保守する。
// フォームに出る関連が無いので関連選択肢の先読み(loadAdminRelationOptions)は無い。

import AdminCouponCreate from "@/features/core/coupon/components/AdminCouponCreate";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "クーポン追加",
};

export function AdminCouponCreateScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">クーポン追加</PageTitle>
      <AdminCouponCreate redirectPath="/admin/coupons/official" />
    </AdminPage>
  );
}
