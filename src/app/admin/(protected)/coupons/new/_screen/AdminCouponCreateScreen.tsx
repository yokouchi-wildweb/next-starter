// src/app/admin/(protected)/coupons/new/_screen/AdminCouponCreateScreen.tsx
// /admin/coupons/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// pnpm generate domain の管理画面と同じ形(_screen/loader.ts が管理画面の共通部品の組を使う)。core ドメインは pnpm generate domain の対象外なので手で保守する。
// フォームに出る関連が無いので関連選択肢の先読みは無い(loader は access の判定だけ)。

import { loadAdminCouponCreateScreen } from "./loader";
import AdminCouponCreate from "@/domains/core/coupon/components/AdminCouponCreate";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

export const { Screen: AdminCouponCreateScreen, generateMetadata } = createScreen({
  load: loadAdminCouponCreateScreen,
  render: () => (
    <AdminPage title="クーポン追加">
      <AdminCouponCreate redirectPath="/admin/coupons/official" />
    </AdminPage>
  ),
  metadata: {
    title: "クーポン追加",
  },
});
