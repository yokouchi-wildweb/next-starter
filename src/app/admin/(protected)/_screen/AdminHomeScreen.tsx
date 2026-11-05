// src/app/admin/(protected)/_screen/AdminHomeScreen.tsx
// /admin の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// セクションのデータは loader(範囲の守りを通った後)が取り、AdminDashboard の data で各セクションへ渡す。

import AdminPage from "@/app/admin/_layout/AdminPage";
import { Stack } from "@/components/Layout/Stack";
import { AdminDashboard } from "@/features/admin/dashboard";
import type { ScreenProps } from "@/lib/screens/types";

import { loadAdminHomeScreen } from "./loader";

export async function AdminHomeScreen(props: ScreenProps) {
  const { sections } = await loadAdminHomeScreen(props);

  return (
    <AdminPage title="管理ダッシュボード">
      <Stack space={8}>
        <AdminDashboard data={sections} />
      </Stack>
    </AdminPage>
  );
}
