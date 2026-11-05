// src/app/admin/(protected)/__domainsSlug__/[id]/edit/_screen/Admin__Domain__EditScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { AdminEditScreenParams, AdminEditScreenSearchParams } from "@/features/core/admin/services/server/screenData/adminEdit";
import type { ScreenProps } from "@/lib/screens/types";
__RELATION_IMPORTS__
import Admin__Domain__Edit from "@/features/__domain__/components/Admin__Domain__Edit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { AdminEditItemNavigator } from "@/app/admin/_layout/AdminEditItemNavigator";
import { domainDisplay as __domain__Display } from "@/features/__domain__/entities/display";

import { loadAdmin__Domain__EditScreen } from "./loader";

export const metadata = {
  title: "__DomainLabel__編集",
};

export async function Admin__Domain__EditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
__EDIT_FETCH__
  return (
__SWR_START__
    <AdminPage title="__DomainLabel__編集" actions={<AdminEditItemNavigator domain={__domain__Display} current={__domain__} />}>
      <Admin__Domain__Edit __domain__={__domain__} redirectPath={redirectPath} />
    </AdminPage>
__SWR_END__
  );
}
