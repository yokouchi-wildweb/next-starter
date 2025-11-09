export const dynamic = "force-dynamic";

import { barService } from "@/features/bar/services/server/barService";

import AdminBarList from "@/features/bar/components/AdminBarList";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";

export const metadata = {
  title: "Bar一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminBarListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: bars, total } = await barService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <AdminPageTitle>Bar管理</AdminPageTitle>
      <AdminBarList bars={bars} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
