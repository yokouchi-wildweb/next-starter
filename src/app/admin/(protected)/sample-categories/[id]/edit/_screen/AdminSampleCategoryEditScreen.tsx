// src/app/admin/(protected)/sample-categories/[id]/edit/_screen/AdminSampleCategoryEditScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { AdminEditScreenParams, AdminEditScreenSearchParams } from "@/features/core/admin/services/server/screenData/adminEdit";
import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleCategoryEdit from "@/features/sampleCategory/components/AdminSampleCategoryEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminSampleCategoryEditScreen } from "./loader";

export const metadata = {
  title: "サンプルカテゴリ編集",
};

export async function AdminSampleCategoryEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: sampleCategory, redirectPath } = await loadAdminSampleCategoryEditScreen(props);
  return (
    <AdminPage>
      <PageTitle placement="header">サンプルカテゴリ編集</PageTitle>
      <AdminSampleCategoryEdit sampleCategory={sampleCategory} redirectPath={redirectPath} />
    </AdminPage>
  );
}
