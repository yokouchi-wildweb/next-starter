export const dynamic = "force-dynamic";


import AdminSampleCategoryCreate from "@/features/sampleCategory/components/AdminSampleCategoryCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "サンプルカテゴリ追加",
};

export default function AdminSampleCategoryCreatePage() {

  return (

    <AdminPage>
      <PageTitle>サンプルカテゴリ追加</PageTitle>
      <AdminSampleCategoryCreate redirectPath="/admin/sample-categories" />
    </AdminPage>

  );
}
