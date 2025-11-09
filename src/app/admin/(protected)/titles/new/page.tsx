// src/app/admin/titles/new/page.tsx

export const dynamic = "force-dynamic";

import AdminTitleCreate from "@/features/title/components/AdminTitleCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";

export const metadata = {
  title: "タイトル追加",
};

export default function AdminTitleCreatePage() {
  return (
    <AdminPage>
      <AdminPageTitle>タイトル追加</AdminPageTitle>
      <AdminTitleCreate redirectPath="/admin/titles" />
    </AdminPage>
  );
}
