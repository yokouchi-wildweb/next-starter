// src/app/admin/users/general/new/page.tsx

export const dynamic = "force-dynamic";

import GeneralUserCreate from "@/features/core/user/components/admin/GeneralUserCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "一般ユーザー追加",
};

const REDIRECT_PATH = "/admin/users/general";

export default function AdminGeneralUserCreatePage() {
  return (
    <AdminPage>
      <PageTitle>一般ユーザー追加</PageTitle>
      <GeneralUserCreate redirectPath={REDIRECT_PATH} />
    </AdminPage>
  );
}
