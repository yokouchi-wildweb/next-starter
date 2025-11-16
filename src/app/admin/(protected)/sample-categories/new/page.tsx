export const dynamic = "force-dynamic";

import AdminSampleCategoryCreate from "@/features/sampleCategory/components/AdminSampleCategoryCreate";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { Main } from "@/components/TextBlocks";


export const metadata = {
  title: "サンプルカテゴリ追加",
};

export default function AdminSampleCategoryCreatePage() {

  return (
    <Main containerType="plain" className="p-6 space-y-6">
      <AdminPageTitle>サンプルカテゴリ追加</AdminPageTitle>
      <AdminSampleCategoryCreate redirectPath="/admin/sample-categories" />
    </Main>
  );
}
