// src/app/admin/(protected)/samples/sort/_screen/AdminSampleSortScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleSort from "@/features/sample/components/AdminSampleSort";
import PageTitle from "@/app/admin/_layout/PageTitle";
import AdminPage from "@/app/admin/_layout/AdminPage";

import { loadAdminSampleSortScreen } from "./loader";

export const metadata = {
  title: "サンプル並び替え",
};

export async function AdminSampleSortScreen(props: ScreenProps) {
  const { results: samples } = await loadAdminSampleSortScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">サンプル並び替え</PageTitle>
      <AdminSampleSort initialSamples={samples} />
    </AdminPage>
  );
}
