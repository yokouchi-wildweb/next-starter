export const dynamic = "force-dynamic";

import AdminSampleCategoryCreate from "@/features/sampleCategory/components/AdminSampleCategoryCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";


export const metadata = {
  title: "サンプルカテゴリ追加",
};

export default function AdminSampleCategoryCreatePage() {

  return (
    <AdminPage>
      <AdminPageTitle>サンプルカテゴリ追加</AdminPageTitle>
      <AdminSampleCategoryCreate redirectPath="/admin/sample-categories" />
    </AdminPage>
  );
}
