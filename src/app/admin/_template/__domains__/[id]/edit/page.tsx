export const dynamic = "force-dynamic";

__RELATION_IMPORTS__
import { __domain__Service } from "@/features/__domain__/services/server/__domain__Service";
import Admin__Domain__Edit from "@/features/__domain__/components/Admin__Domain__Edit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { __Domain__ } from "@/features/__domain__/entities";

export const metadata = {
  title: "__DomainLabel__編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Admin__Domain__EditPage({ params }: Props) {
  const { id } = await params;
__DOMAIN_AND_LIST_FETCH__

  return (
__SWR_START__
    <AdminPage>
      <PageTitle>__DomainLabel__編集</PageTitle>
      <Admin__Domain__Edit __domain__={__domain__ as __Domain__} redirectPath="/admin/__domainsSlug__" />
    </AdminPage>
__SWR_END__
  );
}
