// src/app/admin/(protected)/__domainsSlug__/_screen/Admin__Domain__ListScreen.tsx
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import Admin__Domain__List from "@/domains/__domain__/components/Admin__Domain__List";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadAdmin__Domain__ListScreen } from "./loader";

export const { Screen: Admin__Domain__ListScreen, generateMetadata } = createScreen({
  load: loadAdmin__Domain__ListScreen,
  render: ({ results: __domains__, page, limit, total }) => (
    <AdminPage title="__DomainLabel__管理">
      <Admin__Domain__List __domains__={__domains__} page={page} perPage={limit} total={total} />
    </AdminPage>
  ),
  metadata: {
    title: "__DomainLabel__一覧",
  },
});
