// src/app/admin/(protected)/users/demo/_screen/AdminDemoUserListScreen.tsx
// /admin/users/demo の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import DemoUserList from "@/features/core/user/components/admin/DemoUserList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

import { loadAdminDemoUserListScreen } from "./loader";

export const metadata = {
  title: "デモユーザー",
};

const LIST_PATH = "/admin/users/demo";

export async function AdminDemoUserListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { users, page, perPage, total, sortBy } = await loadAdminDemoUserListScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">デモユーザー</PageTitle>
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
  );
}
