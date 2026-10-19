// src/app/admin/(protected)/users/demo/new/_screen/AdminDemoUserCreateScreen.tsx
// /admin/users/demo/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(サーバー側の取得も遷移制御も無い)。

import DemoUserCreate from "@/features/core/user/components/admin/DemoUserCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "デモユーザー作成",
};

export function AdminDemoUserCreateScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">デモユーザー作成</PageTitle>
      <DemoUserCreate redirectPath="/admin/users/demo" />
    </AdminPage>
  );
}
