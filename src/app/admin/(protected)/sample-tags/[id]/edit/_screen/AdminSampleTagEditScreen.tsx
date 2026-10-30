// src/app/admin/(protected)/sample-tags/[id]/edit/_screen/AdminSampleTagEditScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { AdminEditScreenParams, AdminEditScreenSearchParams } from "@/features/core/admin/services/server/screenData/adminEdit";
import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleTagEdit from "@/features/sampleTag/components/AdminSampleTagEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminSampleTagEditScreen } from "./loader";

export const metadata = {
  title: "サンプルタグ編集",
};

export async function AdminSampleTagEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: sampleTag, redirectPath } = await loadAdminSampleTagEditScreen(props);
  return (
    <AdminPage>
      <PageTitle placement="header">サンプルタグ編集</PageTitle>
      <AdminSampleTagEdit sampleTag={sampleTag} redirectPath={redirectPath} />
    </AdminPage>
  );
}
