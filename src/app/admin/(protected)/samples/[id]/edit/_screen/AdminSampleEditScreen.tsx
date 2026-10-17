// src/app/admin/(protected)/samples/[id]/edit/_screen/AdminSampleEditScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ScreenProps } from "@/lib/screens/types";
import {
  loadAdminEditScreen,
  type AdminEditScreenParams,
  type AdminEditScreenSearchParams,
} from "@/features/core/admin/services/server/loaders/adminEdit";
import { SWRConfig } from "swr";
import { loadAdminRelationLists } from "@/features/core/admin/services/server/loaders/adminRelations";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleEdit from "@/features/sample/components/AdminSampleEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプル編集",
};

export async function AdminSampleEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const [{ record: sample, redirectPath }, { sampleCategories, sampleTags }] = await Promise.all([
    loadAdminEditScreen(sampleService, props, "/admin/samples"),
    loadAdminRelationLists({ sampleCategories: sampleCategoryService, sampleTags: sampleTagService }),
  ]);

  return (
  <SWRConfig
    value={{
      fallback: { sampleCategories, sampleTags },
  }}
  >

    <AdminPage>
      <PageTitle placement="header">サンプル編集</PageTitle>
      <AdminSampleEdit sample={sample} redirectPath={redirectPath} />
    </AdminPage>
  </SWRConfig>
  );
}
