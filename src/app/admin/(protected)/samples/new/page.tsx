export const dynamic = "force-dynamic";

import AdminSampleCreate from "@/features/sample/components/AdminSampleCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { SWRConfig } from "swr";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";

export const metadata = {
  title: "サンプル追加",
};

export default async function AdminSampleCreatePage() {
  const [sampleCategories] = await Promise.all([
    sampleCategoryService.list(),
  ]);

  return (
    <SWRConfig
      value={{
        fallback: { sampleCategories },
      }}
    >
      <AdminPage>
        <AdminPageTitle>サンプル追加</AdminPageTitle>
        <AdminSampleCreate redirectPath="/admin/samples" />
      </AdminPage>
    </SWRConfig>
  );
}
