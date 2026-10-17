// src/app/admin/(protected)/sample-categories/new/_screen/AdminSampleCategoryCreateScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import { SWRConfig } from "swr";
import { loadAdminRelationLists } from "@/features/core/admin/services/server/loaders/adminRelations";
import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleCategoryCreate from "@/features/sampleCategory/components/AdminSampleCategoryCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプルカテゴリ追加",
};

export async function AdminSampleCategoryCreateScreen() {
  const { samples } = await loadAdminRelationLists({ samples: sampleService });

  return (
  <SWRConfig
    value={{
      fallback: { samples },
  }}
  >

    <AdminPage>
      <PageTitle placement="header">サンプルカテゴリ追加</PageTitle>
      <AdminSampleCategoryCreate redirectPath="/admin/sample-categories" />
    </AdminPage>
  </SWRConfig>
  );
}
