// src/app/admin/(protected)/user-tags/new/_screen/AdminUserTagCreateScreen.tsx
// /admin/user-tags/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(_screen/loader.ts が管理画面の共通部品の組を使う)。core ドメインは dc:generate の対象外なので手で保守する。
// フォームに出る関連が無いので関連選択肢の先読みは無い(loader は access の判定だけ)。

import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminUserTagCreateScreen } from "./loader";
import AdminUserTagCreate from "@/features/core/userTag/components/AdminUserTagCreate";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "ユーザータグ追加",
};

export async function AdminUserTagCreateScreen(props: ScreenProps) {
  await loadAdminUserTagCreateScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">ユーザータグ追加</PageTitle>
      <AdminUserTagCreate redirectPath="/admin/user-tags" />
    </AdminPage>
  );
}
