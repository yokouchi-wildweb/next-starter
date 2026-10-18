// src/app/admin/(protected)/samples/new/_screen/AdminSampleCreateScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import { SWRConfig } from "swr";
import { loadAdminRelationOptions } from "@/features/core/admin/services/server/loaders/adminRelationOptions";
import domainConfig from "@/features/sample/domain.json";
import AdminSampleCreate from "@/features/sample/components/AdminSampleCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプル追加",
};

export async function AdminSampleCreateScreen() {
  const relationFallback = await loadAdminRelationOptions(domainConfig);
  return (
  <SWRConfig value={{ fallback: relationFallback }}>
    <AdminPage>
      <PageTitle placement="header">サンプル追加</PageTitle>
      <AdminSampleCreate redirectPath="/admin/samples" />
    </AdminPage>
  </SWRConfig>
  );
}
