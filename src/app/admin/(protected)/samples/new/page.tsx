export const dynamic = "force-dynamic";

import AdminSampleCreate from "@/features/sample/components/AdminSampleCreate";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
import { SWRConfig } from "swr";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";

export const metadata = {
  title: "サンプル追加",
};

export default async function AdminSampleCreatePage() {
  const [sampleCategories ] = await Promise.all([
    sampleCategoryService.list()
  ]);

  return (
  <SWRConfig
    value={{
      fallback: { sampleCategories },
  }}
  >

    <Main containerType="plain">
      <PageTitle>サンプル追加</PageTitle>
      <AdminSampleCreate redirectPath="/admin/samples" />
    </Main>
  </SWRConfig>
  );
}
