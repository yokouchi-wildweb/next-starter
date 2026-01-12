export const dynamic = "force-dynamic";

import { __domain__Service } from "@/features/__domain__/services/server/__domain__Service";
__SQL_IMPORT__
import { settingService } from "../../../../features/core/setting/services/server/settingService";mport type { ListPageSearchParams } from "@/lib/crud";
import Admin__Domain__List from "@/features/__domain__/components/Admin__Domain__List";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "__DomainLabel__一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function Admin__Domain__ListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: __domains__, total } = await __domain__Service.__SEARCH_CALL__;

  return (
    <AdminPage>
      <PageTitle>__DomainLabel__管理</PageTitle>
      <Admin__Domain__List __domains__={__domains__} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
