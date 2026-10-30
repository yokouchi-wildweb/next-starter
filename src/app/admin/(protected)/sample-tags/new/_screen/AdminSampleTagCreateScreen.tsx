// src/app/admin/(protected)/sample-tags/new/_screen/AdminSampleTagCreateScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleTagCreate from "@/features/sampleTag/components/AdminSampleTagCreate";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminSampleTagCreateScreen } from "./loader";

export const metadata = {
  title: "サンプルタグ追加",
};

export async function AdminSampleTagCreateScreen(props: ScreenProps) {
  await loadAdminSampleTagCreateScreen(props);
  return (
    <AdminPage>
      <PageTitle placement="header">サンプルタグ追加</PageTitle>
      <AdminSampleTagCreate redirectPath="/admin/sample-tags" />
    </AdminPage>
  );
}
