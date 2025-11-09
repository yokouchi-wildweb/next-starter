export const dynamic = "force-dynamic";

import AdminBarCreate from "@/features/bar/components/AdminBarCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { SWRConfig } from "swr";
import { titleService } from "@/features/title/services/server/titleService";
import { cardRarityService } from "@/features/cardRarity/services/server/cardRarityService";
import { cardTagService } from "@/features/cardTag/services/server/cardTagService";
import { seriesService } from "@/features/series/services/server/seriesService";

export const metadata = {
  title: "Bar追加",
};

export default async function AdminBarCreatePage() {
  const [titles, cardRarities, cardTags, series ] = await Promise.all([
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
      <AdminPageTitle>Bar追加</AdminPageTitle>
      <AdminBarCreate redirectPath="/admin/bars" />
    </AdminPage>
  </SWRConfig>
  );
}
