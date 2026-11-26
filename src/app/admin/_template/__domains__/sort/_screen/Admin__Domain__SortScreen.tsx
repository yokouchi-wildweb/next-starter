// src/app/admin/(protected)/__domainsSlug__/sort/_screen/Admin__Domain__SortScreen.tsx
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import Admin__Domain__Sort from "@/domains/__folder__/components/Admin__Domain__Sort";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadAdmin__Domain__SortScreen } from "./loader";

export const { Screen: Admin__Domain__SortScreen, generateMetadata } = createScreen({
  load: loadAdmin__Domain__SortScreen,
  render: ({ results: __domains__ }) => (
    <AdminPage title="__DomainLabel__並び替え">
      <Admin__Domain__Sort initial__Domains__={__domains__} />
    </AdminPage>
  ),
  metadata: {
    title: "__DomainLabel__並び替え",
  },
});
