// src/app/admin/(protected)/sample-tags/_screen/AdminSampleTagListScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import AdminSampleTagList from "@/features/sampleTag/components/AdminSampleTagList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプルタグ一覧",
};

export async function AdminSampleTagListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: sampleTags, page, limit, total } = await loadAdminListScreen(sampleTagService, props);

  return (
    <AdminPage>
      <PageTitle placement="header">サンプルタグ管理</PageTitle>
      <AdminSampleTagList sampleTags={sampleTags} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
