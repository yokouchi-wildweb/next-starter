export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleCategoryCreate from "@/features/sampleCategory/components/AdminSampleCategoryCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプルカテゴリ追加",
};

export default async function AdminSampleCategoryCreatePage() {
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
      <PageTitle>サンプルカテゴリ追加</PageTitle>
      <AdminSampleCategoryCreate redirectPath="/admin/sample-categories" />
    </AdminPage>
  </SWRConfig>
  );
}
