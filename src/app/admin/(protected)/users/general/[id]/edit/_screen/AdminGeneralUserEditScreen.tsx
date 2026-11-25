// src/app/admin/(protected)/users/general/[id]/edit/_screen/AdminGeneralUserEditScreen.tsx
// /admin/users/general/[id]/edit の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { GeneralUserEdit } from "@/domains/core/user/components/admin";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadAdminGeneralUserEditScreen } from "./loader";

export const { Screen: AdminGeneralUserEditScreen, generateMetadata } = createScreen({
  load: loadAdminGeneralUserEditScreen,
  render: ({ user, profileData }) => (
    <AdminPage title="一般ユーザー編集">
      <GeneralUserEdit user={user} profileData={profileData} redirectPath="/admin/users/general" />
    </AdminPage>
  ),
  metadata: {
    title: "一般ユーザー編集",
  },
});
