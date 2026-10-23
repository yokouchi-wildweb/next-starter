// src/app/admin/(protected)/__domainsSlug__/_screen/Admin__Domain__ListScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
import { __domain__Service } from "@/features/__domain__/services/server/__domain__Service";
import Admin__Domain__List from "@/features/__domain__/components/Admin__Domain__List";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "__DomainLabel__一覧",
};

export async function Admin__Domain__ListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: __domains__, page, limit, total } = await loadAdminListScreen(__domain__Service, props);

  return (
    <AdminPage>
      <PageTitle placement="header">__DomainLabel__管理</PageTitle>
      <Admin__Domain__List __domains__={__domains__} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
