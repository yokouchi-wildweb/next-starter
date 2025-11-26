export const dynamic = "force-dynamic";

import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import AdminSampleTagEdit from "@/features/sampleTag/components/AdminSampleTagEdit";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
import type { SampleTag } from "@/features/sampleTag/entities";
import { SWRConfig } from "swr";
import { sampleService } from "@/features/sample/services/server/sampleService";

export const metadata = {
  title: "サンプルタグ編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSampleTagEditPage({ params }: Props) {
  const { id } = await params;
  const [sampleTag, samples ] = await Promise.all([
    sampleTagService.get(id),
    sampleService.list()
  ]);


  return (
  <SWRConfig
    value={{
      fallback: { samples },
  }}
  >

    <Main containerType="plain">
      <PageTitle>サンプルタグ編集</PageTitle>
      <AdminSampleTagEdit sampleTag={sampleTag as SampleTag} redirectPath="/admin/sample-tags" />
    </Main>
  </SWRConfig>
  );
}
