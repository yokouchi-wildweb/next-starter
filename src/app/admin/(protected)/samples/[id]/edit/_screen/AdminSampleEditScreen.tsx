// src/app/admin/(protected)/samples/[id]/edit/_screen/AdminSampleEditScreen.tsx
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { AdminEditScreenParams, AdminEditScreenSearchParams } from "@/features/core/admin/services/server/screenData/adminEdit";
import type { ScreenProps } from "@/lib/screens/types";
import { SWRConfig } from "swr";
import AdminSampleEdit from "@/features/sample/components/AdminSampleEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { AdminEditItemNavigator } from "@/app/admin/_layout/AdminEditItemNavigator";
import { domainDisplay as sampleDisplay } from "@/features/sample/entities/display";

import { loadAdminSampleEditScreen } from "./loader";

export const metadata = {
  title: "サンプル編集",
};

export async function AdminSampleEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: sample, redirectPath, relationFallback } = await loadAdminSampleEditScreen(props);
  return (
  <SWRConfig value={{ fallback: relationFallback }}>
    <AdminPage title="サンプル編集" actions={<AdminEditItemNavigator domain={sampleDisplay} current={sample} />}>
      <AdminSampleEdit sample={sample} redirectPath={redirectPath} />
    </AdminPage>
  </SWRConfig>
  );
}
