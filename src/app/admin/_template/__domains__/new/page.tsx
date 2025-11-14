export const dynamic = "force-dynamic";

import Admin__Domain__Create from "@/features/__domain__/components/Admin__Domain__Create";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
__RELATION_IMPORTS__

export const metadata = {
  title: "__DomainLabel__追加",
};

export default __ASYNC__function Admin__Domain__CreatePage() {
__LIST_FETCH__
  return (
__SWR_START__
    <AdminPage>
      <AdminPageTitle>__DomainLabel__追加</AdminPageTitle>
      <Admin__Domain__Create redirectPath="/admin/__domainsSlug__" />
    </AdminPage>
__SWR_END__
  );
}
