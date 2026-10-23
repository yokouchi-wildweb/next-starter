// src/app/admin/(protected)/sample-categories/new/_screen/AdminSampleCategoryCreateScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import AdminSampleCategoryCreate from "@/features/sampleCategory/components/AdminSampleCategoryCreate";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "サンプルカテゴリ追加",
};

export function AdminSampleCategoryCreateScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">サンプルカテゴリ追加</PageTitle>
      <AdminSampleCategoryCreate redirectPath="/admin/sample-categories" />
    </AdminPage>
  );
}
