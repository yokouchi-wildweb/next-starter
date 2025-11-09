// src/app/admin/card-rarities/new/page.tsx

import AdminCardRarityCreate from "@/features/cardRarity/components/AdminCardRarityCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { SWRConfig } from "swr";
import { titleService } from "@/features/title/services/server/titleService";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "レアリティ追加",
};

export default async function AdminCardRarityCreatePage() {
  const titles = await titleService.list();

  return (
    <SWRConfig value={{ fallback: { titles } }}>
      <AdminPage>
        <AdminPageTitle>レアリティ追加</AdminPageTitle>
        <AdminCardRarityCreate redirectPath="/admin/card-rarities" />
      </AdminPage>
    </SWRConfig>
  );
}
