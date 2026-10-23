// src/app/admin/(protected)/sample-categories/[id]/edit/_screen/AdminSampleCategoryEditScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ScreenProps } from "@/lib/screens/types";
import {
  loadAdminEditScreen,
  type AdminEditScreenParams,
  type AdminEditScreenSearchParams,
} from "@/features/core/admin/services/server/loaders/adminEdit";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import AdminSampleCategoryEdit from "@/features/sampleCategory/components/AdminSampleCategoryEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "サンプルカテゴリ編集",
};

export async function AdminSampleCategoryEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: sampleCategory, redirectPath } = await loadAdminEditScreen(sampleCategoryService, props, "/admin/sample-categories");
  return (
    <AdminPage>
      <PageTitle placement="header">サンプルカテゴリ編集</PageTitle>
      <AdminSampleCategoryEdit sampleCategory={sampleCategory} redirectPath={redirectPath} />
    </AdminPage>
  );
}
