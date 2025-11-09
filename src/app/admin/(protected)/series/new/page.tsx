// src/app/admin/series/new/page.tsx

export const dynamic = "force-dynamic";

import AdminSeriesCreate from "@/features/series/components/AdminSeriesCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { SWRConfig } from "swr";
import { titleService } from "@/features/title/services/server/titleService";

export const metadata = {
  title: "シリーズ追加",
};

export default async function AdminSeriesCreatePage() {
  const titles = await titleService.list();

  return (
    <SWRConfig value={{ fallback: { titles } }}>
      <AdminPage>
        <AdminPageTitle>シリーズ追加</AdminPageTitle>
        <AdminSeriesCreate redirectPath="/admin/series" />
      </AdminPage>
    </SWRConfig>
  );
}
