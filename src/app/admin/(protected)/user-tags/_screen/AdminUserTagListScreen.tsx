// src/app/admin/(protected)/user-tags/_screen/AdminUserTagListScreen.tsx
// /admin/user-tags の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(共有 loader を呼ぶ)。core ドメインは dc:generate の対象外なので手で保守する。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
import { userTagService } from "@/features/core/userTag/services/server/userTagService";
import AdminUserTagList from "@/features/core/userTag/components/AdminUserTagList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "ユーザータグ一覧",
};

export async function AdminUserTagListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: userTags, page, limit, total } = await loadAdminListScreen(userTagService, props);

  return (
    <AdminPage>
      <PageTitle placement="header">ユーザータグ管理</PageTitle>
      <AdminUserTagList userTags={userTags} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
