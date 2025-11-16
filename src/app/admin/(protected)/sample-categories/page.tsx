export const dynamic = "force-dynamic";

import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";

import AdminSampleCategoryList from "@/features/sampleCategory/components/AdminSampleCategoryList";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Main } from "@/components/TextBlocks";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";

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
    <Main containerType="plain" className="p-6 space-y-6">
      <AdminPageTitle>サンプルカテゴリ管理</AdminPageTitle>
      <AdminSampleCategoryList sampleCategories={sampleCategories} page={page} perPage={limit} total={total} />
    </Main>
  );
}
