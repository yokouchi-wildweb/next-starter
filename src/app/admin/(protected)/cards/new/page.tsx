// src/app/admin/cards/new/page.tsx
import AdminCardCreate from "@/features/card/components/AdminCardCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { SWRConfig } from "swr";
import { titleService } from "@/features/title/services/server/titleService";
import { cardRarityService } from "@/features/cardRarity/services/server/cardRarityService";
import { cardTagService } from "@/features/cardTag/services/server/cardTagService";
import { seriesService } from "@/features/series/services/server/seriesService";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "カード追加",
};

export default async function AdminCardCreatePage() {
  const [titles, cardRarities, cardTags, series] = await Promise.all([
    titleService.list(),
    cardRarityService.list(),
    cardTagService.list(),
    seriesService.list(),
  ]);

  return (
    <SWRConfig
      value={{
        fallback: { titles, cardRarities, cardTags, series },
      }}
    >
      <AdminPage>
        <AdminPageTitle>カード追加</AdminPageTitle>
        <AdminCardCreate redirectPath="/admin/cards" />
      </AdminPage>
    </SWRConfig>
  );
}
