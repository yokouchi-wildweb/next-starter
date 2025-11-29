export const dynamic = "force-dynamic";

__RELATION_IMPORTS__
import Admin__Domain__Create from "@/features/__domain__/components/Admin__Domain__Create";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "__DomainLabel__追加",
};

export default __ASYNC__function Admin__Domain__CreatePage() {
__LIST_FETCH__
  return (
__SWR_START__
    <AdminPage>
      <PageTitle>__DomainLabel__追加</PageTitle>
      <Admin__Domain__Create redirectPath="/admin/__domainsSlug__" />
    </AdminPage>
__SWR_END__
  );
}
