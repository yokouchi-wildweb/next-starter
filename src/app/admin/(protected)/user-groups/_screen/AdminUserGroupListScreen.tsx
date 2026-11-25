// src/app/admin/(protected)/user-groups/_screen/AdminUserGroupListScreen.tsx
// /admin/user-groups の既定画面(page 層の本体。ユーザーグループの一覧。作る・直すは一覧のモーダル)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { Section } from "@/components/Layout/Section";
import { AdminUserGroupList } from "@/domains/core/userGroup/components/AdminUserGroupList";
import { createScreen } from "@/wiring/screen";

import { loadAdminUserGroupListScreen } from "./loader";

export const { Screen: AdminUserGroupListScreen, generateMetadata } = createScreen({
  load: loadAdminUserGroupListScreen,
  render: () => (
    <AdminPage title="ユーザーグループ">
      <Section>
        <AdminUserGroupList />
      </Section>
    </AdminPage>
  ),
  metadata: {
    title: "ユーザーグループ",
  },
});
