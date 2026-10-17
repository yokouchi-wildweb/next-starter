// src/app/admin/(protected)/__domainsSlug__/[id]/edit/_screen/Admin__Domain__EditScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

import type { ScreenProps } from "@/lib/screens/types";
import {
  loadAdminEditScreen,
  type AdminEditScreenParams,
  type AdminEditScreenSearchParams,
} from "@/features/core/admin/services/server/loaders/adminEdit";
__RELATION_IMPORTS__
import { __domain__Service } from "@/features/__domain__/services/server/__domain__Service";
import Admin__Domain__Edit from "@/features/__domain__/components/Admin__Domain__Edit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "__DomainLabel__編集",
};

export async function Admin__Domain__EditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
__EDIT_FETCH__
  return (
__SWR_START__
    <AdminPage>
      <PageTitle placement="header">__DomainLabel__編集</PageTitle>
      <Admin__Domain__Edit __domain__={__domain__} redirectPath={redirectPath} />
    </AdminPage>
__SWR_END__
  );
}
