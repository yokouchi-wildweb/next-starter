// src/app/admin/(protected)/sample-tags/[id]/edit/_screen/AdminSampleTagEditScreen.tsx
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
import { sampleService } from "@/features/sample/services/server/sampleService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import AdminSampleTagEdit from "@/features/sampleTag/components/AdminSampleTagEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプルタグ編集",
};

export async function AdminSampleTagEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const [{ record: sampleTag, redirectPath }, { samples }] = await Promise.all([
    loadAdminEditScreen(sampleTagService, props, "/admin/sample-tags"),
    loadAdminRelationLists({ samples: sampleService }),
  ]);

  return (
  <SWRConfig
    value={{
      fallback: { samples },
  }}
  >

    <AdminPage>
      <PageTitle placement="header">サンプルタグ編集</PageTitle>
      <AdminSampleTagEdit sampleTag={sampleTag} redirectPath={redirectPath} />
    </AdminPage>
  </SWRConfig>
  );
}
