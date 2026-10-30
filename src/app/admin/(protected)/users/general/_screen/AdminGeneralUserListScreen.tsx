// src/app/admin/(protected)/users/general/_screen/AdminGeneralUserListScreen.tsx
// /admin/users/general の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { GeneralUserList } from "@/features/core/user/components/admin";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminGeneralUserListScreen } from "./loader";

export const metadata = {
  title: "登録ユーザー",
};

const LIST_PATH = "/admin/users/general";

export async function AdminGeneralUserListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { users, page, perPage, total, sortBy } = await loadAdminGeneralUserListScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">登録ユーザー</PageTitle>
      <GeneralUserList
        users={users}
        page={page}
        perPage={perPage}
        total={total}
        title="登録済み一般ユーザーの一覧"
        listPath={LIST_PATH}
        sortBy={sortBy}
      />
    </AdminPage>
  );
}
