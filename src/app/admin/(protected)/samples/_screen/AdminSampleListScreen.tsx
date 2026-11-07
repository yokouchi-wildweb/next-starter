// src/app/admin/(protected)/samples/_screen/AdminSampleListScreen.tsx
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import AdminSampleList from "@/features/sample/components/AdminSampleList";
import AdminPage from "@/app/admin/_layout/AdminPage";

import { loadAdminSampleListScreen } from "./loader";

export const metadata = {
  title: "サンプル一覧",
};

export async function AdminSampleListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: samples, page, limit, total } = await loadAdminSampleListScreen(props);

  return (
    <AdminPage title="サンプル管理">
      <AdminSampleList samples={samples} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
