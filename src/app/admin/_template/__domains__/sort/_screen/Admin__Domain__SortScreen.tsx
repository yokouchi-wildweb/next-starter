// src/app/admin/(protected)/__domainsSlug__/sort/_screen/Admin__Domain__SortScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import { loadAdminSortScreen } from "@/features/core/admin/services/server/loaders/adminSort";
import { __domain__Service } from "@/features/__domain__/services/server/__domain__Service";
import Admin__Domain__Sort from "@/features/__domain__/components/Admin__Domain__Sort";
import PageTitle from "@/app/admin/_layout/PageTitle";
import AdminPage from "@/app/admin/_layout/AdminPage";

export const metadata = {
  title: "__DomainLabel__並び替え",
};

export async function Admin__Domain__SortScreen() {
  const { results: __domains__ } = await loadAdminSortScreen(__domain__Service, "__SORT_ORDER_FIELD__");

  return (
    <AdminPage>
      <PageTitle placement="header">__DomainLabel__並び替え</PageTitle>
      <Admin__Domain__Sort initial__Domains__={__domains__} />
    </AdminPage>
  );
}
