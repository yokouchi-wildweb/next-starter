// src/app/admin/(protected)/users/system/_screen/AdminSystemUserListScreen.tsx
// /admin/users/system の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { ManagerialUserList } from "@/domains/core/user/components/admin";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadAdminSystemUserListScreen } from "./loader";

const LIST_PATH = "/admin/users/system";

export const { Screen: AdminSystemUserListScreen, generateMetadata } = createScreen({
  load: loadAdminSystemUserListScreen,
  render: ({ users, page, perPage, total, sortBy }) => (
    <AdminPage title="システム管理者">
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
  ),
  metadata: {
    title: "システム管理者",
  },
});
