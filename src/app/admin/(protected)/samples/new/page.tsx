export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import AdminSampleCreate from "@/features/sample/components/AdminSampleCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプル追加",
};

export default async function AdminSampleCreatePage() {
  const [sampleCategories, sampleTags ] = await Promise.all([
    sampleCategoryService.list(),
    sampleTagService.list()
  ]);

  return (
  <SWRConfig
    value={{
      fallback: { sampleCategories, sampleTags },
  }}
  >

    <AdminPage>
      <PageTitle>サンプル追加</PageTitle>
      <AdminSampleCreate redirectPath="/admin/samples" />
    </AdminPage>
  </SWRConfig>
  );
}
