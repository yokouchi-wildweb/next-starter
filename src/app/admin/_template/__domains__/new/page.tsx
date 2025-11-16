export const dynamic = "force-dynamic";

import Admin__Domain__Create from "@/features/__domain__/components/Admin__Domain__Create";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Main } from "@/components/TextBlocks";
__RELATION_IMPORTS__

export const metadata = {
  title: "__DomainLabel__追加",
};

export default __ASYNC__function Admin__Domain__CreatePage() {
__LIST_FETCH__
  return (
__SWR_START__
    <Main containerType="plain">
      <AdminPageTitle>__DomainLabel__追加</AdminPageTitle>
      <Admin__Domain__Create redirectPath="/admin/__domainsSlug__" />
    </Main>
__SWR_END__
  );
}
