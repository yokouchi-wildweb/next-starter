// src/app/admin/(protected)/users/demo/_screen/AdminDemoUserListScreen.tsx
// /admin/users/demo の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { DemoUserList } from "@/domains/core/demo/components";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadAdminDemoUserListScreen } from "./loader";

const LIST_PATH = "/admin/users/demo";

export const { Screen: AdminDemoUserListScreen, generateMetadata } = createScreen({
  load: loadAdminDemoUserListScreen,
  render: ({ users, page, perPage, total, sortBy }) => (
    <AdminPage title="デモユーザー">
      <DemoUserList
        users={users}
        page={page}
        perPage={perPage}
        total={total}
        title="登録済みデモユーザーの一覧"
        listPath={LIST_PATH}
        sortBy={sortBy}
      />
    </AdminPage>
  ),
  metadata: {
    title: "デモユーザー",
  },
});
