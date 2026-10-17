// src/app/admin/(protected)/samples/sort/_screen/AdminSampleSortScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import { loadAdminSortScreen } from "@/features/core/admin/services/server/loaders/adminSort";
import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleSort from "@/features/sample/components/AdminSampleSort";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";

export const metadata = {
  title: "サンプル並び替え",
};

export async function AdminSampleSortScreen() {
  const { results: samples } = await loadAdminSortScreen(sampleService, "sort_order");

  return (
    <AdminPage>
      <PageTitle placement="header">サンプル並び替え</PageTitle>
      <AdminSampleSort initialSamples={samples} />
    </AdminPage>
  );
}
