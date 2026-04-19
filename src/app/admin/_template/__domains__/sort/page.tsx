// src/app/admin/(protected)/__domainsSlug__/sort/page.tsx

export const dynamic = "force-dynamic";

import { __domain__Service } from "@/features/__domain__/services/server/__domain__Service";
import Admin__Domain__Sort from "@/features/__domain__/components/Admin__Domain__Sort";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";

export const metadata = {
  title: "__DomainLabel__並び替え",
};

export default async function Admin__Domain__SortPage() {
  const { results: __domains__ } = await __domain__Service.searchForSorting({
    page: 1,
    limit: 100,
    orderBy: [["sort_order", "ASC", "LAST"]],
  });

  return (
    <AdminPage>
      <PageTitle>__DomainLabel__並び替え</PageTitle>
      <Admin__Domain__Sort initial__Domains__={__domains__} />
    </AdminPage>
  );
}
