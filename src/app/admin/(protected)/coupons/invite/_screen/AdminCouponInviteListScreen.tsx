// src/app/admin/(protected)/coupons/invite/_screen/AdminCouponInviteListScreen.tsx
// /admin/coupons/invite の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import AdminInviteList from "@/features/core/referral/components/AdminInviteList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";
import { Para } from "@/components/TextBlocks/Para";

import { CouponSectionTabs } from "../../_screen/CouponSectionTabs";
import { loadAdminCouponInviteListScreen } from "./loader";

export const metadata = {
  title: "クーポン一覧（ユーザー招待）",
};

export async function AdminCouponInviteListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const data = await loadAdminCouponInviteListScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">クーポン管理</PageTitle>
      <CouponSectionTabs placement="header" />
      {data.enabled ? (
        <AdminInviteList items={data.items} page={data.page} perPage={data.perPage} total={data.total} />
      ) : (
        <Para>ユーザーの紹介機能が無効です</Para>
      )}
    </AdminPage>
  );
}
