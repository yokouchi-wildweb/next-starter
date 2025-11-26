export const dynamic = "force-dynamic";

import AdminSampleCreate from "@/features/sample/components/AdminSampleCreate";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
import { SWRConfig } from "swr";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";

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

    <Main containerType="plain">
      <PageTitle>サンプル追加</PageTitle>
      <AdminSampleCreate redirectPath="/admin/samples" />
    </Main>
  </SWRConfig>
  );
}
