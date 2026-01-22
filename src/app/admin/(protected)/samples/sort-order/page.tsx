// src/app/admin/(protected)/samples/sort-order/page.tsx

export const dynamic = "force-dynamic";

import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { SampleSortableList } from "./_components/SampleSortableList";

export const metadata = {
  title: "サンプル並び替え（デモ）",
};

export default async function SampleSortOrderDemoPage() {
  const { results: samples } = await sampleService.search({ page: 1, limit: 20 });

  return (
    <AdminPage>
      <PageTitle>サンプル並び替え（デモ）</PageTitle>
      <SampleSortableList initialSamples={samples} />
    </AdminPage>
  );
}
