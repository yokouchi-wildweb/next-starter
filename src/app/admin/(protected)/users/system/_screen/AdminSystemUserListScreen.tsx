// src/app/admin/(protected)/users/system/_screen/AdminSystemUserListScreen.tsx
// /admin/users/system の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import ManagerialUserList from "@/features/core/user/components/admin/ManagerialUserList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminSystemUserListScreen } from "./loader";

export const metadata = {
  title: "システム管理者",
};

const LIST_PATH = "/admin/users/system";

export async function AdminSystemUserListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { users, page, perPage, total, sortBy } = await loadAdminSystemUserListScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">システム管理者</PageTitle>
      <ManagerialUserList
        users={users}
        page={page}
        perPage={perPage}
        total={total}
        title="登録済みシステム管理者の一覧"
        listPath={LIST_PATH}
        searchPlaceholder="管理者名またはメールアドレスで検索"
        sortBy={sortBy}
      />
    </AdminPage>
  );
}
