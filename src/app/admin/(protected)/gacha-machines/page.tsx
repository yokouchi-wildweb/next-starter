export const dynamic = "force-dynamic";

import { gachaMachineService } from "@/features/gachaMachine/services/server/gachaMachineService";

import AdminGachaMachineList from "@/features/gachaMachine/components/AdminGachaMachineList";
import PageTitle from "../../../../components/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/types/page";

export const metadata = {
  title: "ガチャマシン一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminGachaMachineListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: gachaMachines, total } = await gachaMachineService.search({ page, limit, searchQuery });

  return (
    <Main containerType="plain">
      <PageTitle>ガチャマシン管理</PageTitle>
      <AdminGachaMachineList gachaMachines={gachaMachines} page={page} perPage={limit} total={total} />
    </Main>
  );
}
