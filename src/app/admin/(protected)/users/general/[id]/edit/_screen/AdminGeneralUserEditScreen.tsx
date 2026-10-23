// src/app/admin/(protected)/users/general/[id]/edit/_screen/AdminGeneralUserEditScreen.tsx
// /admin/users/general/[id]/edit の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ScreenProps } from "@/lib/screens/types";
import GeneralUserEdit from "@/features/core/user/components/admin/GeneralUserEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminGeneralUserEditScreen, type AdminGeneralUserEditScreenParams } from "./loader";

export const metadata = {
  title: "一般ユーザー編集",
};

export async function AdminGeneralUserEditScreen(props: ScreenProps<AdminGeneralUserEditScreenParams>) {
  const { user, profileData } = await loadAdminGeneralUserEditScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">一般ユーザー編集</PageTitle>
      <GeneralUserEdit user={user} profileData={profileData} redirectPath="/admin/users/general" />
    </AdminPage>
  );
}
