export const dynamic = "force-dynamic";

import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";

import AdminSampleTagList from "@/features/sampleTag/components/AdminSampleTagList";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";

export const metadata = {
  title: "サンプルタグ一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminSampleTagListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: sampleTags, total } = await sampleTagService.search({ page, limit, searchQuery });

  return (
    <Main containerType="plain">
      <PageTitle>サンプルタグ管理</PageTitle>
      <AdminSampleTagList sampleTags={sampleTags} page={page} perPage={limit} total={total} />
    </Main>
  );
}
