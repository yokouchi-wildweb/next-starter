// src/app/admin/(protected)/__domainsSlug__/new/_screen/Admin__Domain__CreateScreen.tsx
// このファイルは pnpm generate domain が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

__RELATION_IMPORTS__
import Admin__Domain__Create from "@/domains/__domain__/components/Admin__Domain__Create";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";

import { loadAdmin__Domain__CreateScreen } from "./loader";

export const { Screen: Admin__Domain__CreateScreen, generateMetadata } = createScreen({
  load: loadAdmin__Domain__CreateScreen,
  render: (__CREATE_RENDER_PARAMS__) => (
__SWR_START__
    <AdminPage title="__DomainLabel__追加">
      <Admin__Domain__Create redirectPath="/admin/__domainsSlug__" />
    </AdminPage>
__SWR_END__
  ),
  metadata: {
    title: "__DomainLabel__追加",
  },
});
