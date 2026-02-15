export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { sampleService } from "@/features/sample/services/server/sampleService";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import AdminSampleCategoryEdit from "@/features/sampleCategory/components/AdminSampleCategoryEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { SampleCategory } from "@/features/sampleCategory/entities";
import { resolveReturnTo } from "@/lib/crud/utils";

export const metadata = {
  title: "サンプルカテゴリ編集",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function AdminSampleCategoryEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const redirectPath = resolveReturnTo(returnTo, "/admin/sample-categories");

  const [sampleCategory, samples ] = await Promise.all([
    sampleCategoryService.get(id),
    sampleService.list()
  ]);


  return (
  <SWRConfig
    value={{
      fallback: { samples },
  }}
  >

    <AdminPage>
      <PageTitle>サンプルカテゴリ編集</PageTitle>
      <AdminSampleCategoryEdit sampleCategory={sampleCategory as SampleCategory} redirectPath={redirectPath} />
    </AdminPage>
  </SWRConfig>
  );
}
