// src/app/admin/card-rarities/page.tsx
import { cardRarityService } from "@/features/cardRarity/services/server/cardRarityService";
import { titleService } from "@/features/title/services/server/titleService";
import AdminCardRarityList from "@/features/cardRarity/components/AdminCardRarityList";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { settingService } from "@/features/setting/services/server/settingService";
import type { Title } from "@/features/title/entities";
import type { ListPageSearchParams } from "@/types/page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "レアリティ一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams & { titleId?: string }>;
};

export default async function AdminCardRarityListPage({ searchParams }: Props) {
  const { titleId, page: pageStr } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();
  const { rarities, total } = await cardRarityService.search({ page, limit: perPage, titleId });
  const titles = (await titleService.list()) as Title[];

  return (
    <AdminPage>
      <AdminPageTitle>レアリティ管理</AdminPageTitle>
      <AdminCardRarityList
        rarities={rarities}
        titles={titles}
        selectedTitleId={titleId}
        page={page}
        perPage={perPage}
        total={total}
      />
    </AdminPage>
  );
}
