export const dynamic = "force-dynamic";

import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleEdit from "@/features/sample/components/AdminSampleEdit";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
import type { Sample } from "@/features/sample/entities";
import { SWRConfig } from "swr";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";

export const metadata = {
  title: "サンプル編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSampleEditPage({ params }: Props) {
  const { id } = await params;
  const [sample, sampleCategories, sampleTags ] = await Promise.all([
    sampleService.get(id),
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
      <PageTitle>サンプル編集</PageTitle>
      <AdminSampleEdit sample={sample as Sample} redirectPath="/admin/samples" />
    </Main>
  </SWRConfig>
  );
}
