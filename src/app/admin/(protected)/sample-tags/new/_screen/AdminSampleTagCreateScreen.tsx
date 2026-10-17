// src/app/admin/(protected)/sample-tags/new/_screen/AdminSampleTagCreateScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import { SWRConfig } from "swr";
import { loadAdminRelationLists } from "@/features/core/admin/services/server/loaders/adminRelations";
import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleTagCreate from "@/features/sampleTag/components/AdminSampleTagCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプルタグ追加",
};

export async function AdminSampleTagCreateScreen() {
  const { samples } = await loadAdminRelationLists({ samples: sampleService });

  return (
  <SWRConfig
    value={{
      fallback: { samples },
  }}
  >

    <AdminPage>
      <PageTitle placement="header">サンプルタグ追加</PageTitle>
      <AdminSampleTagCreate redirectPath="/admin/sample-tags" />
    </AdminPage>
  </SWRConfig>
  );
}
