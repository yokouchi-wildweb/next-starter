// src/app/admin/(protected)/page.tsx

import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import { Stack } from "@/components/Layout/Stack";
import { AdminDashboard } from "@/features/admin/dashboard";

// ダッシュボード本体は features/admin/dashboard 配下のセクション登録方式で構築。
// 本ファイルはレイアウトシェルに徹する。セクションの追加・削除・差し替えは
// `src/features/core/admin/dashboard/registry.ts` で行う。
export const dynamic = "force-dynamic";

export default function AdminHomePage() {
  return (
    <AdminPage>
      <Stack space={8}>
        <PageTitle placement="header">管理ダッシュボード</PageTitle>
        <AdminDashboard />
      </Stack>
    </AdminPage>
  );
}
