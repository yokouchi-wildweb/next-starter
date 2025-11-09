export const dynamic = "force-dynamic";

import { sampleService } from "@/features/sample/services/server/sampleService";

import AdminSampleList from "@/features/sample/components/AdminSampleList";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";

export const metadata = {
  title: "サンプル一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminSampleListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: samples, total } = await sampleService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <AdminPageTitle>サンプル管理</AdminPageTitle>
      <AdminSampleList samples={samples} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
