// src/app/admin/(protected)/samples/new/_screen/AdminSampleCreateScreen.tsx
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ScreenProps } from "@/lib/screens/types";
import { SWRConfig } from "swr";
import AdminSampleCreate from "@/features/sample/components/AdminSampleCreate";
import AdminPage from "@/app/admin/_layout/AdminPage";

import { loadAdminSampleCreateScreen } from "./loader";

export const metadata = {
  title: "サンプル追加",
};

export async function AdminSampleCreateScreen(props: ScreenProps) {
  const { relationFallback } = await loadAdminSampleCreateScreen(props);
  return (
  <SWRConfig value={{ fallback: relationFallback }}>
    <AdminPage title="サンプル追加">
      <AdminSampleCreate redirectPath="/admin/samples" />
    </AdminPage>
  </SWRConfig>
  );
}
