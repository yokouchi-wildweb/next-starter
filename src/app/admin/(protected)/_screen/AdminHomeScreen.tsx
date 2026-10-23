// src/app/admin/(protected)/_screen/AdminHomeScreen.tsx
// /admin の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(ダッシュボードのウィジェットはそれぞれ自分で取得する。管理者判定は layout の authGuard)。

import PageTitle from "@/app/admin/_layout/PageTitle";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { Stack } from "@/components/Layout/Stack";
import { AdminDashboard } from "@/features/admin/dashboard";

export function AdminHomeScreen() {
  return (
    <AdminPage>
      <Stack space={8}>
        <PageTitle placement="header">管理ダッシュボード</PageTitle>
        <AdminDashboard />
      </Stack>
    </AdminPage>
  );
}
