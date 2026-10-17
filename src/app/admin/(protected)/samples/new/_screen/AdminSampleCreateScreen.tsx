// src/app/admin/(protected)/samples/new/_screen/AdminSampleCreateScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import { SWRConfig } from "swr";
import { loadAdminRelationLists } from "@/features/core/admin/services/server/loaders/adminRelations";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import AdminSampleCreate from "@/features/sample/components/AdminSampleCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプル追加",
};

export async function AdminSampleCreateScreen() {
  const { sampleCategories, sampleTags } = await loadAdminRelationLists({ sampleCategories: sampleCategoryService, sampleTags: sampleTagService });

  return (
  <SWRConfig
    value={{
      fallback: { sampleCategories, sampleTags },
  }}
  >

    <AdminPage>
      <PageTitle placement="header">サンプル追加</PageTitle>
      <AdminSampleCreate redirectPath="/admin/samples" />
    </AdminPage>
  </SWRConfig>
  );
}
