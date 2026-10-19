// src/app/admin/(protected)/user-tags/new/_screen/AdminUserTagCreateScreen.tsx
// /admin/user-tags/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(共有 loader を呼ぶ)。core ドメインは dc:generate の対象外なので手で保守する。
// フォームに出る関連が無いので関連選択肢の先読み(loadAdminRelationOptions)は無い。

import AdminUserTagCreate from "@/features/core/userTag/components/AdminUserTagCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "ユーザータグ追加",
};

export function AdminUserTagCreateScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">ユーザータグ追加</PageTitle>
      <AdminUserTagCreate redirectPath="/admin/user-tags" />
    </AdminPage>
  );
}
