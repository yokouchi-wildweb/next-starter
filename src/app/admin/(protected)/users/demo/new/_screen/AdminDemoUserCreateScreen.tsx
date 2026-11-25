// src/app/admin/(protected)/users/demo/new/_screen/AdminDemoUserCreateScreen.tsx
// /admin/users/demo/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(サーバー側の取得も遷移制御も無い)。

import { DemoUserCreate } from "@/domains/core/user/components/admin";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadAdminDemoUserCreateScreen } from "./loader";

export const { Screen: AdminDemoUserCreateScreen, generateMetadata } = createScreen({
  load: loadAdminDemoUserCreateScreen,
  render: () => (
    <AdminPage title="デモユーザー作成">
      <DemoUserCreate redirectPath="/admin/users/demo" />
    </AdminPage>
  ),
  metadata: {
    title: "デモユーザー作成",
  },
});
