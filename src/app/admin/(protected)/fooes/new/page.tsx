export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import AdminFooCreate from "@/features/foo/components/AdminFooCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "foo追加",
};

export default async function AdminFooCreatePage() {
  const [sampleCategories ] = await Promise.all([
    sampleCategoryService.list()
  ]);

  return (
  <SWRConfig
    value={{
      fallback: { sampleCategories },
  }}
  >

    <AdminPage>
      <PageTitle>foo追加</PageTitle>
      <AdminFooCreate redirectPath="/admin/fooes" />
    </AdminPage>
  </SWRConfig>
  );
}
