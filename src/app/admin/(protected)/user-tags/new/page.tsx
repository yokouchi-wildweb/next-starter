export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { userService } from "@/features/user/services/server/userService";
import AdminUserTagCreate from "@/features/core/userTag/components/AdminUserTagCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "ユーザータグ追加",
};

export default async function AdminUserTagCreatePage() {
  const [users ] = await Promise.all([
    userService.list()
  ]);

  return (
  <SWRConfig
    value={{
      fallback: { users },
  }}
  >

    <AdminPage>
      <PageTitle>ユーザータグ追加</PageTitle>
      <AdminUserTagCreate redirectPath="/admin/user-tags" />
    </AdminPage>
  </SWRConfig>
  );
}
