// src/app/admin/(protected)/user-tags/[id]/edit/_screen/AdminUserTagEditScreen.tsx
// /admin/user-tags/[id]/edit の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// pnpm generate domain の管理画面と同じ形(_screen/loader.ts が管理画面の共通部品の組を使う)。core ドメインは pnpm generate domain の対象外なので手で保守する。
// レコードが無ければ 404、保存後の戻り先は ?returnTo=(無ければ一覧)。どちらも loader が判定する。

import type { ScreenProps } from "@/lib/screens/types";
import type { AdminEditScreenParams, AdminEditScreenSearchParams } from "@/features/core/admin/services/server/screenData/adminEdit";
import { loadAdminUserTagEditScreen } from "./loader";
import AdminUserTagEdit from "@/features/core/userTag/components/AdminUserTagEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { AdminEditItemNavigator } from "@/app/admin/_layout/AdminEditItemNavigator";
import { domainDisplay as userTagDisplay } from "@/features/core/userTag/entities/display";

export const metadata = {
  title: "ユーザータグ編集",
};

export async function AdminUserTagEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: userTag, redirectPath } = await loadAdminUserTagEditScreen(props);

  return (
    <AdminPage title="ユーザータグ編集" actions={<AdminEditItemNavigator domain={userTagDisplay} current={userTag} />}>
      <AdminUserTagEdit userTag={userTag} redirectPath={redirectPath} />
    </AdminPage>
  );
}
