// src/app/admin/(protected)/users/system/[id]/edit/_screen/AdminSystemUserEditScreen.tsx
// /admin/users/system/[id]/edit の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ScreenProps } from "@/lib/screens/types";
import ManagerialUserEdit from "@/features/core/user/components/admin/ManagerialUserEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

import { loadAdminSystemUserEditScreen, type AdminSystemUserEditScreenParams } from "./loader";

export const metadata = {
  title: "システム管理者編集",
};

export async function AdminSystemUserEditScreen(props: ScreenProps<AdminSystemUserEditScreenParams>) {
  const { user, profileData } = await loadAdminSystemUserEditScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">システム管理者編集</PageTitle>
      <ManagerialUserEdit user={user} profileData={profileData} redirectPath="/admin/users/system" />
    </AdminPage>
  );
}
