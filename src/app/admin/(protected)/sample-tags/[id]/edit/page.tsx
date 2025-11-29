export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { sampleService } from "@/features/sample/services/server/sampleService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import AdminSampleTagEdit from "@/features/sampleTag/components/AdminSampleTagEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { SampleTag } from "@/features/sampleTag/entities";

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

    <AdminPage>
      <PageTitle>サンプルタグ編集</PageTitle>
      <AdminSampleTagEdit sampleTag={sampleTag as SampleTag} redirectPath="/admin/sample-tags" />
    </AdminPage>
  </SWRConfig>
  );
}
