// src/app/admin/(protected)/sample-categories/_screen/AdminSampleCategoryListScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import AdminSampleCategoryList from "@/features/sampleCategory/components/AdminSampleCategoryList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプルカテゴリ一覧",
};

export async function AdminSampleCategoryListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: sampleCategories, page, limit, total } = await loadAdminListScreen(sampleCategoryService, props);

  return (
    <AdminPage>
      <PageTitle placement="header">サンプルカテゴリ管理</PageTitle>
      <AdminSampleCategoryList sampleCategories={sampleCategories} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
