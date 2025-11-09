// src/app/admin/cards/page.tsx
import { cardService } from "@/features/card/services/server/cardService";
import AdminCardList from "@/features/card/components/AdminCardList";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "カード一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminCardListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const perPage = await settingService.getAdminListPerPage();
  const { cards, total } = await cardService.search({ page, limit: perPage, keyword: searchQuery });

  return (
    <AdminPage>
      <AdminPageTitle>カード管理</AdminPageTitle>
      <AdminCardList cards={cards} page={page} perPage={perPage} total={total} />
    </AdminPage>
  );
}
