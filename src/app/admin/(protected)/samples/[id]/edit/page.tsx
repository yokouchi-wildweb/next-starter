export const dynamic = "force-dynamic";

import { sampleService } from "@/features/sample/services/server/sampleService";
import AdminSampleEdit from "@/features/sample/components/AdminSampleEdit";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import type { Sample } from "@/features/sample/entities";
import { SWRConfig } from "swr";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { Main } from "@/components/TextBlocks";

export const metadata = {
  title: "サンプル編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSampleEditPage({ params }: Props) {
  const { id } = await params;
  const [sample, sampleCategories] = await Promise.all([
    sampleService.get(id),
    sampleCategoryService.list(),
  ]);


  return (
    <SWRConfig
      value={{
        fallback: { sampleCategories },
      }}
    >
      <Main containerType="plain" className="p-6 space-y-6">
        <AdminPageTitle>サンプル編集</AdminPageTitle>
        <AdminSampleEdit sample={sample as Sample} redirectPath="/admin/samples" />
      </Main>
    </SWRConfig>
  );
}
