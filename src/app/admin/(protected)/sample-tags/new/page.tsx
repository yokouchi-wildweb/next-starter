export const dynamic = "force-dynamic";

import AdminSampleTagCreate from "@/features/sampleTag/components/AdminSampleTagCreate";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Main } from "@/components/TextBlocks";
import { SWRConfig } from "swr";
import { sampleService } from "@/features/sample/services/server/sampleService";

export const metadata = {
  title: "サンプルタグ追加",
};

export default async function AdminSampleTagCreatePage() {
  const [samples ] = await Promise.all([
    sampleService.list()
  ]);

  return (
  <SWRConfig
    value={{
      fallback: { samples },
  }}
  >

    <Main containerType="plain">
      <PageTitle>サンプルタグ追加</PageTitle>
      <AdminSampleTagCreate redirectPath="/admin/sample-tags" />
    </Main>
  </SWRConfig>
  );
}
