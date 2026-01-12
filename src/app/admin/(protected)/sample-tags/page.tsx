export const dynamic = "force-dynamic";

import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";

import { settingService } from "../../../../features/core/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/lib/crud";
import AdminSampleTagList from "@/features/sampleTag/components/AdminSampleTagList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

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
    <AdminPage>
      <PageTitle>サンプルタグ管理</PageTitle>
      <AdminSampleTagList sampleTags={sampleTags} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
