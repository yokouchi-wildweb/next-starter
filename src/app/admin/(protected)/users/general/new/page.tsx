// src/app/admin/users/general/new/page.tsx

export const dynamic = "force-dynamic";

import GeneralUserCreate from "@/features/user/components/admin/GeneralUserCreate";
import AdminPage from "@/components/Admin/Layout/AdminPage";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";

export const metadata = {
  title: "一般ユーザー追加",
};

const REDIRECT_PATH = "/admin/users/general";

export default function AdminGeneralUserCreatePage() {
  return (
    <AdminPage>
      <AdminPageTitle>一般ユーザー追加</AdminPageTitle>
      <GeneralUserCreate redirectPath={REDIRECT_PATH} />
    </AdminPage>
  );
}
