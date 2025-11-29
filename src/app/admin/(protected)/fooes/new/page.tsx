export const dynamic = "force-dynamic";


import AdminFooCreate from "@/features/foo/components/AdminFooCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "foo追加",
};

export default function AdminFooCreatePage() {

  return (

    <AdminPage>
      <PageTitle>foo追加</PageTitle>
      <AdminFooCreate redirectPath="/admin/fooes" />
    </AdminPage>

  );
}
