// src/app/admin/(protected)/users/general/_screen/AdminGeneralUserListScreen.tsx
// /admin/users/general の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { GeneralUserList } from "@/domains/core/user/components/admin";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadAdminGeneralUserListScreen } from "./loader";

const LIST_PATH = "/admin/users/general";

export const { Screen: AdminGeneralUserListScreen, generateMetadata } = createScreen({
  load: loadAdminGeneralUserListScreen,
  render: ({ users, page, perPage, total, sortBy }) => (
    <AdminPage title="登録ユーザー">
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
  ),
  metadata: {
    title: "登録ユーザー",
  },
});
