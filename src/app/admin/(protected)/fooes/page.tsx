export const dynamic = "force-dynamic";

import { fooService } from "@/features/foo/services/server/fooService";

import { settingService } from "../../../../features/core/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";
import AdminFooList from "@/features/foo/components/AdminFooList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "foo一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminFooListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: fooes, total } = await fooService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <PageTitle>foo管理</PageTitle>
      <AdminFooList fooes={fooes} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
