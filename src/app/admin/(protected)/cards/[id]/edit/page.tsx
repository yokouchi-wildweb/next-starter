// src/app/admin/cards/[id]/edit/page.tsx
import { cardService } from "@/features/card/services/server/cardService";
import AdminCardEdit from "@/features/card/components/AdminCardEdit";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import type { CardWithRelations } from "@/features/card/entities";
import { SWRConfig } from "swr";
import { titleService } from "@/features/title/services/server/titleService";
import { cardRarityService } from "@/features/cardRarity/services/server/cardRarityService";
import { cardTagService } from "@/features/cardTag/services/server/cardTagService";
import { seriesService } from "@/features/series/services/server/seriesService";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "カード編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCardEditPage({ params }: Props) {
  const { id } = await params;
  const [card, titles, cardRarities, cardTags, series] = await Promise.all([
    cardService.get(id),
    titleService.list(),
    cardRarityService.list(),
    cardTagService.list(),
    seriesService.list(),
  ]);

  return (
    <SWRConfig
      value={{
        fallback: {
          titles,
          cardRarities,
          cardTags,
          series,
        },
      }}
    >
      <AdminPage>
        <AdminPageTitle>カード編集</AdminPageTitle>
        <AdminCardEdit card={card as CardWithRelations} redirectPath="/admin/cards" />
      </AdminPage>
    </SWRConfig>
  );
}
