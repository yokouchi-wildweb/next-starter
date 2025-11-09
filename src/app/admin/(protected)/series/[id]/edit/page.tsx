// src/app/admin/series/[id]/edit/page.tsx

export const dynamic = "force-dynamic";

import { seriesService } from "@/features/series/services/server/seriesService";
import AdminSeriesEdit from "@/features/series/components/AdminSeriesEdit";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import type { Series } from "@/features/series/entities";
import { SWRConfig } from "swr";
import { titleService } from "@/features/title/services/server/titleService";

export const metadata = {
  title: "シリーズ編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSeriesEditPage({ params }: Props) {
  const { id } = await params;
  const [series, titles] = await Promise.all([
    seriesService.get(id),
    titleService.list(),
  ]);

  return (
    <SWRConfig value={{ fallback: { titles } }}>
      <AdminPage>
        <AdminPageTitle>シリーズ編集</AdminPageTitle>
        <AdminSeriesEdit series={series as Series} redirectPath="/admin/series" />
      </AdminPage>
    </SWRConfig>
  );
}
