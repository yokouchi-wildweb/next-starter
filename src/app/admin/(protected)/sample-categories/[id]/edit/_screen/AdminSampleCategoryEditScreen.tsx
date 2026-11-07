// src/app/admin/(protected)/sample-categories/[id]/edit/_screen/AdminSampleCategoryEditScreen.tsx
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { AdminEditScreenParams, AdminEditScreenSearchParams } from "@/features/core/admin/services/server/screenData/adminEdit";
import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleCategoryEdit from "@/features/sampleCategory/components/AdminSampleCategoryEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { AdminEditItemNavigator } from "@/app/admin/_layout/AdminEditItemNavigator";
import { domainDisplay as sampleCategoryDisplay } from "@/features/sampleCategory/entities/display";

import { loadAdminSampleCategoryEditScreen } from "./loader";

export const metadata = {
  title: "サンプルカテゴリ編集",
};

export async function AdminSampleCategoryEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: sampleCategory, redirectPath } = await loadAdminSampleCategoryEditScreen(props);
  return (
    <AdminPage title="サンプルカテゴリ編集" actions={<AdminEditItemNavigator domain={sampleCategoryDisplay} current={sampleCategory} />}>
      <AdminSampleCategoryEdit sampleCategory={sampleCategory} redirectPath={redirectPath} />
    </AdminPage>
  );
}
