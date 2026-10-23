// src/app/admin/(protected)/users/system/new/_screen/AdminSystemUserCreateScreen.tsx
// /admin/users/system/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(サーバー側の取得も遷移制御も無い)。

import ManagerialUserCreate from "@/features/core/user/components/admin/ManagerialUserCreate";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "システム管理者追加",
};

export function AdminSystemUserCreateScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">システム管理者追加</PageTitle>
      <ManagerialUserCreate redirectPath="/admin/users/system" />
    </AdminPage>
  );
}
