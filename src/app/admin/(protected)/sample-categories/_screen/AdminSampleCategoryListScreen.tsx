// src/app/admin/(protected)/sample-categories/_screen/AdminSampleCategoryListScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleCategoryList from "@/features/sampleCategory/components/AdminSampleCategoryList";
import AdminPage from "@/app/admin/_layout/AdminPage";

import { loadAdminSampleCategoryListScreen } from "./loader";

export const metadata = {
  title: "サンプルカテゴリ一覧",
};

export async function AdminSampleCategoryListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: sampleCategories, page, limit, total } = await loadAdminSampleCategoryListScreen(props);

  return (
    <AdminPage title="サンプルカテゴリ管理">
      <AdminSampleCategoryList sampleCategories={sampleCategories} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
