// src/app/admin/(protected)/sample-tags/_screen/AdminSampleTagListScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleTagList from "@/features/sampleTag/components/AdminSampleTagList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminSampleTagListScreen } from "./loader";

export const metadata = {
  title: "サンプルタグ一覧",
};

export async function AdminSampleTagListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: sampleTags, page, limit, total } = await loadAdminSampleTagListScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">サンプルタグ管理</PageTitle>
      <AdminSampleTagList sampleTags={sampleTags} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
