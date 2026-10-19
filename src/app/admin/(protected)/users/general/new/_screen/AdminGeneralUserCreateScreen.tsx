// src/app/admin/(protected)/users/general/new/_screen/AdminGeneralUserCreateScreen.tsx
// /admin/users/general/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(サーバー側の取得も遷移制御も無い)。

import GeneralUserCreate from "@/features/core/user/components/admin/GeneralUserCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "一般ユーザー追加",
};

export function AdminGeneralUserCreateScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">一般ユーザー追加</PageTitle>
      <GeneralUserCreate redirectPath="/admin/users/general" />
    </AdminPage>
  );
}
