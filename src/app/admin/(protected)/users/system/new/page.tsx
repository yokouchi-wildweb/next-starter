// src/app/admin/users/system/new/page.tsx

export const dynamic = "force-dynamic";

import ManagerialUserCreate from "@/features/core/user/components/admin/ManagerialUserCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "システム管理者追加",
};

const REDIRECT_PATH = "/admin/users/system";

export default function AdminSystemUserCreatePage() {
  return (
    <AdminPage>
      <PageTitle>システム管理者追加</PageTitle>
      <ManagerialUserCreate redirectPath={REDIRECT_PATH} />
    </AdminPage>
  );
}
