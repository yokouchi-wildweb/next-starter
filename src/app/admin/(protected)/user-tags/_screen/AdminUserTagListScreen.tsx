// src/app/admin/(protected)/user-tags/_screen/AdminUserTagListScreen.tsx
// /admin/user-tags の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// pnpm generate domain の管理画面と同じ形(_screen/loader.ts が管理画面の共通部品の組を使う)。core ドメインは pnpm generate domain の対象外なので手で保守する。

import { loadAdminUserTagListScreen } from "./loader";
import AdminUserTagList from "@/domains/core/userTag/components/AdminUserTagList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

export const { Screen: AdminUserTagListScreen, generateMetadata } = createScreen({
  load: loadAdminUserTagListScreen,
  render: ({ results: userTags, page, limit, total }) => (
    <AdminPage title="ユーザータグ管理">
      <AdminUserTagList userTags={userTags} page={page} perPage={limit} total={total} />
    </AdminPage>
  ),
  metadata: {
    title: "ユーザータグ一覧",
  },
});
