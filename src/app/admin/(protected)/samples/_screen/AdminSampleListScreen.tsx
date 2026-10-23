// src/app/admin/(protected)/samples/_screen/AdminSampleListScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleList from "@/features/sample/components/AdminSampleList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "サンプル一覧",
};

export async function AdminSampleListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: samples, page, limit, total } = await loadAdminListScreen(sampleService, props);

  return (
    <AdminPage>
      <PageTitle placement="header">サンプル管理</PageTitle>
      <AdminSampleList samples={samples} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
