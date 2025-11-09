export const dynamic = "force-dynamic";

import { cardTagService } from "@/features/cardTag/services/server/cardTagService";
import AdminCardTagList from "@/features/cardTag/components/AdminCardTagList";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";

export const metadata = {
  title: "カードタグ一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminCardTagListPage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();
  const { results: cardTags, total } = await cardTagService.search({ page, limit: perPage });

  return (
    <AdminPage>
      <AdminPageTitle>カードタグ管理</AdminPageTitle>
      <AdminCardTagList cardTags={cardTags} page={page} perPage={perPage} total={total} />
    </AdminPage>
  );
}
