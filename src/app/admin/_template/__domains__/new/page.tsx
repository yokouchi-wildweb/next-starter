export const dynamic = "force-dynamic";

import Admin__Domain__Create from "@/features/__domain__/components/Admin__Domain__Create";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
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
      <PageTitle>__DomainLabel__追加</PageTitle>
      <Admin__Domain__Create redirectPath="/admin/__domainsSlug__" />
    </Main>
__SWR_END__
  );
}
