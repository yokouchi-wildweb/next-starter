// src/app/admin/titles/page.tsx

export const dynamic = "force-dynamic";

import { titleService } from "@/features/title/services/server/titleService";
import AdminTitleList from "@/features/title/components/AdminTitleList";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";

export const metadata = {
  title: "タイトル一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminTitleListPage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();
  const { results: titles, total } = await titleService.search({ page, limit: perPage });

  return (
    <AdminPage>
      <AdminPageTitle>タイトル管理</AdminPageTitle>
      <AdminTitleList titles={titles} page={page} perPage={perPage} total={total} />
    </AdminPage>
  );
}
