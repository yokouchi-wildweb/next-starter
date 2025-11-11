// src/app/admin/users/managerial/new/page.tsx

export const dynamic = "force-dynamic";

import ManagerialUserCreate from "@/features/user/components/admin/ManagerialUserCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";

export const metadata = {
  title: "システム管理者追加",
};

const REDIRECT_PATH = "/admin/users/managerial";

export default function AdminManagerialUserCreatePage() {
  return (
    <AdminPage>
      <AdminPageTitle>システム管理者追加</AdminPageTitle>
      <ManagerialUserCreate redirectPath={REDIRECT_PATH} />
    </AdminPage>
  );
}
