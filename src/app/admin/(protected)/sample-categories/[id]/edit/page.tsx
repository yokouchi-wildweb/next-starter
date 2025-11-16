export const dynamic = "force-dynamic";

import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import AdminSampleCategoryEdit from "@/features/sampleCategory/components/AdminSampleCategoryEdit";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import type { SampleCategory } from "@/features/sampleCategory/entities";


export const metadata = {
  title: "サンプルカテゴリ編集",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminSampleCategoryEditPage({ params }: Props) {
  const { id } = await params;
  const sampleCategory = (await sampleCategoryService.get(id)) as SampleCategory;


  return (
    <AdminPage>
      <AdminPageTitle>サンプルカテゴリ編集</AdminPageTitle>
      <AdminSampleCategoryEdit sampleCategory={sampleCategory as SampleCategory} redirectPath="/admin/sample-categories" />
    </AdminPage>
  );
}
