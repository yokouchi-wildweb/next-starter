// src/app/admin/(protected)/__domainsSlug__/new/_screen/Admin__Domain__CreateScreen.tsx
// このファイルは dc:generate が生成する(再生成で上書きされるため手で編集しない)。
// 画面を変えるときは _components/ にコピーして page.tsx の import 先を向ける。

__RELATION_IMPORTS__
import Admin__Domain__Create from "@/features/__domain__/components/Admin__Domain__Create";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "__DomainLabel__追加",
};

export __ASYNC__function Admin__Domain__CreateScreen() {
__RELATION_FETCH__
  return (
__SWR_START__
    <AdminPage>
      <PageTitle placement="header">__DomainLabel__追加</PageTitle>
      <Admin__Domain__Create redirectPath="/admin/__domainsSlug__" />
    </AdminPage>
__SWR_END__
  );
}
