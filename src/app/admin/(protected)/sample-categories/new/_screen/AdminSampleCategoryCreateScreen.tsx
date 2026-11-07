// src/app/admin/(protected)/sample-categories/new/_screen/AdminSampleCategoryCreateScreen.tsx
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleCategoryCreate from "@/features/sampleCategory/components/AdminSampleCategoryCreate";
import AdminPage from "@/app/admin/_layout/AdminPage";

import { loadAdminSampleCategoryCreateScreen } from "./loader";

export const metadata = {
  title: "サンプルカテゴリ追加",
};

export async function AdminSampleCategoryCreateScreen(props: ScreenProps) {
  await loadAdminSampleCategoryCreateScreen(props);
  return (
    <AdminPage title="サンプルカテゴリ追加">
      <AdminSampleCategoryCreate redirectPath="/admin/sample-categories" />
    </AdminPage>
  );
}
