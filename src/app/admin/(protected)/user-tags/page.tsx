export const dynamic = "force-dynamic";

import { userTagService } from "@/features/core/userTag/services/server/userTagService";

import { settingService } from "../../../../features/core/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/lib/crud";
import AdminUserTagList from "@/features/core/userTag/components/AdminUserTagList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "ユーザータグ一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminUserTagListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: userTags, total } = await userTagService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <PageTitle>ユーザータグ管理</PageTitle>
      <AdminUserTagList userTags={userTags} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
