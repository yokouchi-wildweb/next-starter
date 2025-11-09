// src/app/admin/series/page.tsx
import { seriesService } from "@/features/series/services/server/seriesService";
import { titleService } from "@/features/title/services/server/titleService";
import AdminSeriesList from "@/features/series/components/AdminSeriesList";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { settingService } from "@/features/setting/services/server/settingService";
import type { Title } from "@/features/title/entities";
import type { ListPageSearchParams } from "@/types/page";
import type { WhereExpr } from "@/lib/crud";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "シリーズ一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams & { titleId?: string }>;
};

export default async function AdminSeriesListPage({ searchParams }: Props) {
  const { titleId, page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();
  const where: WhereExpr | undefined =
    titleId ? { field: "titleId", op: "eq", value: titleId } : undefined;
  const { results: series, total } = await seriesService.search({
    page,
    limit: perPage,
    where,
  });
  const titles = (await titleService.list()) as Title[];

  return (
    <AdminPage>
      <AdminPageTitle>シリーズ管理</AdminPageTitle>
      <AdminSeriesList
        series={series}
        titles={titles}
        selectedTitleId={titleId}
        page={page}
        perPage={perPage}
        total={total}
      />
    </AdminPage>
  );
}
