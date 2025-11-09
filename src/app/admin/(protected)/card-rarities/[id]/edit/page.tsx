// src/app/admin/card-rarities/[id]/edit/page.tsx
import { cardRarityService } from "@/features/cardRarity/services/server/cardRarityService";
import AdminCardRarityEdit from "@/features/cardRarity/components/AdminCardRarityEdit";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { SWRConfig } from "swr";
import { titleService } from "@/features/title/services/server/titleService";

export const dynamic = "force-dynamic";
import type { CardRarity } from "@/features/cardRarity/entities";

export const metadata = {
  title: "レアリティ編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminCardRarityEditPage({ params }: Props) {
  const { id } = await params;
  const [rarity, titles] = await Promise.all([
    cardRarityService.get(id),
    titleService.list(),
  ]);

  return (
    <SWRConfig value={{ fallback: { titles } }}>
      <AdminPage>
        <AdminPageTitle>レアリティ編集</AdminPageTitle>
        <AdminCardRarityEdit rarity={rarity as CardRarity} redirectPath="/admin/card-rarities" />
      </AdminPage>
    </SWRConfig>
  );
}
