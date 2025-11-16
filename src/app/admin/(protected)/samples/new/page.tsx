export const dynamic = "force-dynamic";

import AdminSampleCreate from "@/features/sample/components/AdminSampleCreate";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Main } from "@/components/TextBlocks";
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
      <Main containerType="plain">
        <AdminPageTitle>サンプル追加</AdminPageTitle>
        <AdminSampleCreate redirectPath="/admin/samples" />
      </Main>
    </SWRConfig>
  );
}
