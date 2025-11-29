export const dynamic = "force-dynamic";

import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";

import { settingService } from "../../../../features/core/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";
import AdminSampleCategoryList from "@/features/sampleCategory/components/AdminSampleCategoryList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプルカテゴリ一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminSampleCategoryListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: sampleCategories, total } = await sampleCategoryService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <PageTitle>サンプルカテゴリ管理</PageTitle>
      <AdminSampleCategoryList sampleCategories={sampleCategories} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
