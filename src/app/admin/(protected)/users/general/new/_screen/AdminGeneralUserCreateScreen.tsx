// src/app/admin/(protected)/users/general/new/_screen/AdminGeneralUserCreateScreen.tsx
// /admin/users/general/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(サーバー側の取得も遷移制御も無い)。

import type { ScreenProps } from "@/lib/screens/types";
import { GeneralUserCreate } from "@/features/core/user/components/admin";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminGeneralUserCreateScreen } from "./loader";

export const metadata = {
  title: "一般ユーザー追加",
};

export async function AdminGeneralUserCreateScreen(props: ScreenProps) {
  await loadAdminGeneralUserCreateScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">一般ユーザー追加</PageTitle>
      <GeneralUserCreate redirectPath="/admin/users/general" />
    </AdminPage>
  );
}
