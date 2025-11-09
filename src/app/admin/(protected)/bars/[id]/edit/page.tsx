export const dynamic = "force-dynamic";

import { barService } from "@/features/bar/services/server/barService";
import AdminBarEdit from "@/features/bar/components/AdminBarEdit";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import type { Bar } from "@/features/bar/entities";
import { SWRConfig } from "swr";
import { titleService } from "@/features/title/services/server/titleService";
import { cardRarityService } from "@/features/cardRarity/services/server/cardRarityService";
import { cardTagService } from "@/features/cardTag/services/server/cardTagService";
import { seriesService } from "@/features/series/services/server/seriesService";

export const metadata = {
  title: "Bar編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminBarEditPage({ params }: Props) {
  const { id } = await params;
  const [bar, titles, cardRarities, cardTags, series ] = await Promise.all([
    barService.get(id),
    titleService.list(),
    cardRarityService.list(),
    cardTagService.list(),
    seriesService.list()
  ]);


  return (
  <SWRConfig
    value={{
      fallback: { titles, cardRarities, cardTags, series },
  }}
  >

    <AdminPage>
      <AdminPageTitle>Bar編集</AdminPageTitle>
      <AdminBarEdit bar={bar as Bar} redirectPath="/admin/bars" />
    </AdminPage>
  </SWRConfig>
  );
}
