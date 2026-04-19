// src/app/admin/(protected)/samples/sort/page.tsx

export const dynamic = "force-dynamic";

import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleSort from "@/features/sample/components/AdminSampleSort";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";

export const metadata = {
  title: "サンプル並び替え",
};

export default async function AdminSampleSortPage() {
  const { results: samples } = await sampleService.searchForSorting({
    page: 1,
    limit: 100,
    orderBy: [["sort_order", "ASC", "LAST"]],
  });

  return (
    <AdminPage>
      <PageTitle>サンプル並び替え</PageTitle>
      <AdminSampleSort initialSamples={samples} />
    </AdminPage>
  );
}
