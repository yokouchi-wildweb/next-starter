export const dynamic = "force-dynamic";

import AdminCardTagCreate from "@/features/cardTag/components/AdminCardTagCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";

export const metadata = {
  title: "カードタグ追加",
};

export default function AdminCardTagCreatePage() {
  return (
    <AdminPage>
      <AdminPageTitle>カードタグ追加</AdminPageTitle>
      <AdminCardTagCreate redirectPath="/admin/card-tags" />
    </AdminPage>
  );
}
