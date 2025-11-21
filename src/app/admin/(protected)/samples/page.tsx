export const dynamic = "force-dynamic";

import { sampleService } from "@/features/sample/services/server/sampleService";

import AdminSampleList from "@/features/sample/components/AdminSampleList";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
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
    <Main containerType="plain">
      <PageTitle>サンプル管理</PageTitle>
      <AdminSampleList samples={samples} page={page} perPage={limit} total={total} />
    </Main>
  );
}
