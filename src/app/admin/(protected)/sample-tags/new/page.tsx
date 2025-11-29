export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleTagCreate from "@/features/sampleTag/components/AdminSampleTagCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

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

    <AdminPage>
      <PageTitle>サンプルタグ追加</PageTitle>
      <AdminSampleTagCreate redirectPath="/admin/sample-tags" />
    </AdminPage>
  </SWRConfig>
  );
}
